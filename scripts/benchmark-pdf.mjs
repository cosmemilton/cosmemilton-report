// Usa os entrypoints públicos compilados. Execute `npm run build` antes do benchmark.
// Cada PDF usa um único worker; a validação textual ocorre depois de encerrá-lo.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const FIXTURE_VERSION = "realistic-products-v2";

const HELP = `Benchmark PDF tabular: 9 colunas, A4 paisagem, dados sintéticos.

node scripts/benchmark-pdf.mjs [opções]
  --rows 1000,7833,10000       Volumes sequenciais (padrão: 1000)
  --api buffer|document       API de servidor (padrão: buffer) ou árvore React PDF
  --engine auto|react-pdf     Motor da API de servidor (omitido: padrão auto)
  --max-rows-per-block N|false Tamanho dos blocos; false usa a paginação anterior
                             (omitido: padrão da biblioteca)
  --module CAMINHO_OU_FILE_URL Entry /pdf compilado alternativo para comparação
                             (padrão: cosmemilton-report/pdf)
  --heap-mb 512               Limite do old generation do worker, em MiB
  --timeout-ms 110000         Prazo por geração, incluindo inicialização
  --validation auto|text|basic Validação com pdfjs-dist quando disponível (auto)
                             text exige pdfjs-dist; basic só confere assinatura/EOF
  --output-dir CAMINHO        Salva PDFs e eventos JSONL (opcional)
  --help                     Exibe esta ajuda, sem carregar o renderer

Saída: um objeto JSON por linha. Falha, timeout ou PDF inválido encerra com código 1.
Não acessa banco, rede, fontes externas nem dados de clientes.
`;

function positiveInteger(value, option, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${option}: informe um inteiro entre 1 e ${maximum}.`);
  }
  return number;
}

function parseOptions(args) {
  const options = {
    rows: [1000],
    heapMb: 512,
    timeoutMs: 110000,
    validation: "auto",
    api: "buffer",
    module: "cosmemilton-report/pdf",
  };
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (option === "--help") return { help: true };
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Falta o valor de ${option}.`);
    switch (option) {
      case "--rows":
        options.rows = value.split(",").map((n) => positiveInteger(n, option, 100000));
        break;
      case "--api":
        if (!["buffer", "document"].includes(value)) throw new Error("API desconhecida.");
        options.api = value;
        break;
      case "--engine":
        if (!["auto", "react-pdf"].includes(value)) throw new Error("Motor desconhecido.");
        options.engine = value;
        break;
      case "--heap-mb":
        options.heapMb = positiveInteger(value, option, 32768);
        break;
      case "--timeout-ms":
        options.timeoutMs = positiveInteger(value, option, 2147483647);
        break;
      case "--max-rows-per-block":
        options.maxRowsPerBlock = value === "false" ? false : positiveInteger(value, option);
        break;
      case "--module":
        options.module = value.startsWith("file:") ? value : pathToFileURL(resolve(value)).href;
        break;
      case "--validation":
        if (!["auto", "text", "basic"].includes(value)) throw new Error("Validação desconhecida.");
        options.validation = value;
        break;
      case "--output-dir":
        options.outputDir = resolve(value);
        break;
      default:
        throw new Error(`Opção desconhecida: ${option}. Use --help.`);
    }
  }
  return options;
}

const round = (n) => Math.round(n * 10) / 10;
const mib = (n) => round(n / 1024 / 1024);
const memory = () => {
  const { rss, heapUsed, heapTotal, external } = process.memoryUsage();
  return {
    rssMiB: mib(rss),
    heapUsedMiB: mib(heapUsed),
    heapTotalMiB: mib(heapTotal),
    externalMiB: mib(external),
  };
};
const describeError = (error) => ({
  name: error?.name,
  code: error?.code,
  message: error?.message ?? String(error),
  stack: error?.stack,
  ...(error?.cause ? { cause: describeError(error.cause) } : {}),
});

function syntheticReport(count, createElement, Text, View) {
  const fields = [
    ["COD_PRODUTO", "Código", 1.8],
    ["DESCRICAO", "Descrição", 3.5],
    ["COD_NCM", "NCM", 1.3],
    ["VENDA", "Venda", 1.3, 2],
    ["ST", "ST", 1.3],
    ["ICMS_IN", "ICMS", 1.3, 2],
    ["CSTPC", "CST P/C", 1.3],
    ["ESTOQUE", "Estoque", 1.3, 3],
    ["GONDOLA", "Gôndola", 1.3],
  ];
  const totalWeight = fields.reduce((sum, field) => sum + field[2], 0);
  const rows = Array.from({ length: count }, (_, index) => ({
    COD_PRODUTO: String(index + 1).padStart(6, "0"),
    DESCRICAO: `Produto de conferência ${String(index + 1).padStart(6, "0")}`,
    COD_NCM: String(21069000 + (index % 47)),
    VENDA: (((index * 37) % 35000) + 99) / 100,
    ST: index % 3 === 0 ? "0060" : "0000",
    ICMS_IN: [0, 7, 12, 18, 20][index % 5],
    CSTPC: index % 5 === 0 ? "4" : "1",
    ESTOQUE: ((index * 13) % 5000) / 10,
    GONDOLA: "0",
  }));
  return {
    definition: {
      slug: "benchmark-produtos",
      name: "Listagem de produtos",
      columns: fields.map(([key, header, weight, scale]) => ({
        key,
        header,
        width: `${(weight / totalWeight) * 100}%`,
        align: scale === undefined ? "left" : "right",
        format: "text",
        noTotal: true,
        // Reproduz a formatação por célula do adaptador SRI, inclusive o custo de Intl.
        exportValue: (row) =>
          scale === undefined
            ? String(row[key])
            : row[key].toLocaleString("pt-BR", {
                minimumFractionDigits: scale,
                maximumFractionDigits: scale,
              }),
      })),
      style: { fontSize: 8, headerFontSize: 8, density: "compact", zebraStripes: true },
      sections: [
        {
          id: "filters",
          position: "before-table",
          pdfRender: () =>
            createElement(
              View,
              { style: { marginBottom: 10 } },
              createElement(
                Text,
                { style: { fontSize: 8, marginBottom: 4 } },
                "Situação: ativos · Busca: conferência",
              ),
            ),
        },
        {
          id: "totals",
          position: "after-table",
          pdfRender: () =>
            createElement(
              View,
              {
                wrap: false,
                style: {
                  marginTop: 10,
                  paddingTop: 6,
                  borderTopWidth: 1,
                  borderTopColor: "#d1d5db",
                },
              },
              createElement(Text, { style: { fontSize: 8 } }, `Total geral · ${count} linha(s)`),
            ),
        },
      ],
    },
    rows,
    generatedAt: new Date("2026-09-13T12:00:00.000Z"),
    globalConfig: {
      companyName: "SRI · Loja 0002",
      showCompanyName: true,
      showLogo: false,
      paperSize: "A4",
      orientation: "landscape",
      marginTopMm: 10,
      marginBottomMm: 12,
      marginLeftMm: 10,
      marginRightMm: 10,
      footerText: "SRI Integrador",
    },
  };
}

async function renderWorker() {
  const { options, count, startedAt } = workerData;
  const started = performance.now();
  let observedHeapPeakMiB = 0;
  const sample = () => {
    const current = memory();
    observedHeapPeakMiB = Math.max(observedHeapPeakMiB, current.heapUsedMiB);
    return current;
  };
  const sampler = setInterval(sample, 250);
  try {
    const [
      { createReportDocument, renderReportToBuffer, Text, View },
      { renderToBuffer },
      { createElement },
    ] = await Promise.all([import(options.module), import("@react-pdf/renderer"), import("react")]);
    const startupMs = round(Date.now() - startedAt);
    const importMs = round(performance.now() - started);
    const initialMemory = sample();
    const fixtureStart = performance.now();
    const input = syntheticReport(count, createElement, Text, View);
    const fixtureMs = round(performance.now() - fixtureStart);
    const pdfOptions =
      options.maxRowsPerBlock === undefined && options.engine === undefined
        ? undefined
        : {
            ...(options.engine === undefined ? {} : { engine: options.engine }),
            ...(options.maxRowsPerBlock === undefined
              ? {}
              : { maxRowsPerBlock: options.maxRowsPerBlock }),
          };
    // A API buffer prepara internamente. Não criar outra árvore só para medi-la:
    // duplicaria trabalho e manteria as milhares de células vivas durante o benchmark.
    let document;
    let preparationMs = null;
    let preparedMemory = null;
    if (options.api === "document") {
      const preparationStart = performance.now();
      document = createReportDocument(input, pdfOptions);
      preparationMs = round(performance.now() - preparationStart);
      preparedMemory = sample();
    }
    const beforeGenerationMemory = sample();
    parentPort.postMessage({
      event: "prepared",
      count,
      api: options.api,
      preparationIncludedInApi: options.api === "buffer",
      startupMs,
      importMs,
      fixtureMs,
      preparationMs,
      initialMemory,
      preparedMemory,
      beforeGenerationMemory,
    });
    const renderStart = performance.now();
    const pdf =
      options.api === "buffer"
        ? await renderReportToBuffer(input, pdfOptions)
        : await renderToBuffer(document);
    const elapsedMs = round(performance.now() - renderStart);
    const renderMs = options.api === "document" ? elapsedMs : null;
    const apiGenerationMs = options.api === "buffer" ? elapsedMs : null;
    const renderedMemory = sample();
    const bytes = Uint8Array.from(pdf);
    parentPort.postMessage(
      {
        event: "rendered",
        count,
        api: options.api,
        preparationIncludedInApi: options.api === "buffer",
        startupMs,
        importMs,
        fixtureMs,
        preparationMs,
        renderMs,
        apiGenerationMs,
        initialMemory,
        preparedMemory,
        beforeGenerationMemory,
        renderedMemory,
        observedHeapPeakMiB,
        pdf: bytes,
      },
      [bytes.buffer],
    );
  } catch (error) {
    parentPort.postMessage({
      event: "workerFailure",
      count,
      error: describeError(error),
      memory: sample(),
      observedHeapPeakMiB,
    });
  } finally {
    clearInterval(sampler);
  }
}

async function validatePdf(pdf, count, mode) {
  const started = performance.now();
  if (
    pdf.subarray(0, 5).toString() !== "%PDF-" ||
    !pdf.subarray(-1024).includes(Buffer.from("%%EOF"))
  ) {
    throw new Error("PDF sem assinatura ou marcador final válidos.");
  }
  let pdfjs;
  if (mode !== "basic") {
    try {
      pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    } catch (error) {
      if (mode === "text" || error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    }
  }
  if (!pdfjs)
    return {
      mode: "basic",
      valid: true,
      textValidation: "skipped",
      validationMs: round(performance.now() - started),
    };
  const task = pdfjs.getDocument({
    data: Uint8Array.from(pdf),
    useSystemFonts: true,
    verbosity: 0,
  });
  const document = await task.promise;
  const codes = [];
  let totalOccurrences = 0;
  let columnHeaderOccurrences = 0;
  let pageNumbersValid = true;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const values = items.filter((item) => "str" in item).map((item) => item.str.trim());
      codes.push(...values.filter((value) => /^\d{6}$/.test(value)));
      totalOccurrences += values.filter((value) => value.includes("Total geral")).length;
      columnHeaderOccurrences += values.filter((value) => value === "Código").length;
      const pageNumbers = [...values.join(" ").matchAll(/Página\s+(\d+)\s+de\s+(\d+)/g)];
      pageNumbersValid &&=
        pageNumbers.length === 1 &&
        Number(pageNumbers[0][1]) === pageNumber &&
        Number(pageNumbers[0][2]) === document.numPages;
      page.cleanup();
    }
    const correctOrder =
      codes.length === count && codes.every((code, i) => code === String(i + 1).padStart(6, "0"));
    if (
      !correctOrder ||
      totalOccurrences !== 1 ||
      columnHeaderOccurrences < 1 ||
      !pageNumbersValid
    ) {
      throw new Error(
        `Conteúdo divergente: ${codes.length}/${count} códigos; ordem=${correctOrder}; totais=${totalOccurrences}; cabeçalhos=${columnHeaderOccurrences}; numeração=${pageNumbersValid}.`,
      );
    }
    return {
      mode: "text",
      valid: true,
      pages: document.numPages,
      rowCount: codes.length,
      firstCode: codes[0],
      lastCode: codes.at(-1),
      correctOrder,
      totalOccurrences,
      columnHeaderOccurrences,
      pageNumbersValid,
      validationMs: round(performance.now() - started),
    };
  } finally {
    await task.destroy();
  }
}

async function runCase(options, count, emit) {
  const startedAt = Date.now();
  let peakObservedProcessRssMiB = memory().rssMiB;
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { options, count, startedAt },
    execArgv: [],
    resourceLimits: { maxOldGenerationSizeMb: options.heapMb },
    stdout: true,
    stderr: true,
  });
  emit({ event: "started", count, resourceLimits: worker.resourceLimits });
  const sampler = setInterval(() => {
    peakObservedProcessRssMiB = Math.max(peakObservedProcessRssMiB, memory().rssMiB);
  }, 100);
  worker.stdout.on("data", (data) => emit({ event: "workerStdout", count, text: data.toString() }));
  worker.stderr.on("data", (data) => emit({ event: "workerStderr", count, text: data.toString() }));
  const rendered = await new Promise((resolveResult) => {
    let finishing = false;
    const finish = async (result) => {
      if (finishing) return;
      finishing = true;
      clearTimeout(timeout);
      clearInterval(sampler);
      peakObservedProcessRssMiB = Math.max(peakObservedProcessRssMiB, memory().rssMiB);
      const generationMs = Date.now() - startedAt;
      await worker.terminate();
      resolveResult({ ...result, generationMs, peakObservedProcessRssMiB });
    };
    const timeout = setTimeout(
      () =>
        void finish({
          status: "timeout",
          error: {
            code: "BENCHMARK_TIMEOUT",
            message: `Prazo de ${options.timeoutMs} ms excedido.`,
          },
        }),
      options.timeoutMs,
    );
    worker.on("message", (message) => {
      if (message.event === "rendered") return void finish({ ...message, status: "success" });
      if (message.event === "workerFailure") return void finish({ ...message, status: "error" });
      emit(message);
    });
    worker.once("error", (error) => void finish({ status: "error", error: describeError(error) }));
    worker.once("exit", (code) => {
      if (!finishing)
        void finish({
          status: "error",
          error: {
            code: "WORKER_EXIT",
            message: `Worker encerrou com código ${code}, sem resultado.`,
          },
        });
    });
  });
  const { pdf: rawPdf, ...result } = rendered;
  if (rawPdf) {
    const pdf = Buffer.from(rawPdf);
    result.bytes = pdf.length;
    if (options.outputDir) {
      result.pdfPath = resolve(options.outputDir, `products-${count}.pdf`);
      await writeFile(result.pdfPath, pdf);
    }
    try {
      result.validation = await validatePdf(pdf, count, options.validation);
    } catch (error) {
      result.status = "invalidPdf";
      result.error = describeError(error);
    }
  }
  emit({ ...result, event: "result", count });
  return result.status === "success";
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) return process.stdout.write(HELP);
  let log = "";
  const emit = (event) => {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      fixtureVersion: FIXTURE_VERSION,
      ...event,
    });
    process.stdout.write(line + "\n");
    log += line + "\n";
  };
  if (options.outputDir) await mkdir(options.outputDir, { recursive: true });
  const { version } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  emit({
    event: "environment",
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    packageVersion: version,
    options,
    memoryNotes:
      "RSS abrange o processo inteiro (amostragem 100 ms); heap pertence ao worker. Pico observado de heap pode perder alocações durante trabalho síncrono.",
    timingNotes:
      "generationMs inclui inicialização, fixture e PDF, sem validação. --api buffer mede apiGenerationMs (preparação e geração internas), com preparationMs/renderMs=null. --api document separa preparationMs (createReportDocument) de renderMs (React PDF). Nenhum modo prepara a árvore duas vezes.",
  });
  try {
    for (const count of options.rows) {
      if (!(await runCase(options, count, emit))) process.exitCode = 1;
    }
  } finally {
    if (options.outputDir) await writeFile(resolve(options.outputDir, "benchmark.jsonl"), log);
  }
}

if (isMainThread) {
  main().catch((error) => {
    process.stdout.write(JSON.stringify({ event: "fatal", error: describeError(error) }) + "\n");
    process.exitCode = 1;
  });
} else {
  await renderWorker();
}
