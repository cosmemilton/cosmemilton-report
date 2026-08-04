// report-response.ts — entry /next: helpers para servir relatórios de dentro de um route
// handler (`Response` padrão Web — não importa nada de "next", o nome do entry é só semântico).
// Formatos "leves" (csv/tsv/json) usam o core estaticamente (zero-dep, sempre disponível);
// pdf/xlsx são carregados via `import()` DINÂMICO para que os peers opcionais
// (@react-pdf/renderer, exceljs) só entrem no bundle/processo quando o formato é realmente usado.
import { exportReportToCsv, exportReportToJson, exportReportToTsv } from "../core/export.js";
import type { ReportOutputFormat, ReportRenderInput } from "../core/types.js";

/** `Content-Type` por formato de saída. */
export const reportMimeTypes: Record<ReportOutputFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  json: "application/json; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `aaaa-mm-dd` a partir dos componentes LOCAIS de `date` (mesma convenção de "data local" usada
 *  em `core/formatters.ts`) — evita o dia mudar por causa do fuso horário. */
function toIsoDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Remove acentos/diacríticos (via NFD + descarte dos marcadores de combinação) e troca qualquer
 *  caractere fora de `[A-Za-z0-9._-]` por "_" — produz o `filename` ASCII exigido como fallback
 *  do `filename*` UTF-8 (RFC 6266 / RFC 5987) em `Content-Disposition`. */
function toAsciiFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Monta o valor do header `Content-Disposition`: `filename` ASCII saneado (compatibilidade) +
 *  `filename*=UTF-8''...` percent-encoded (nome real, com acentos) — como manda o RFC 5987. */
function buildContentDisposition(fileNameWithExt: string, inline: boolean | undefined): string {
  const type = inline ? "inline" : "attachment";
  const asciiName = toAsciiFileName(fileNameWithExt);
  const utf8Name = encodeURIComponent(fileNameWithExt);
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}

export type ReportResponseOptions = {
  body: Uint8Array | string | ReadableStream<Uint8Array>;
  format: ReportOutputFormat;
  /** Sem extensão — a extensão é anexada de acordo com `format` (ex.: "relatorio" → "relatorio.pdf"). */
  fileName: string;
  /** `true` = exibir inline no navegador em vez de baixar. Default: `false` (attachment). */
  inline?: boolean;
  /** Default: `"no-store"`. */
  cacheControl?: string;
};

/**
 * Monta uma `Response` pronta para um route handler: `Content-Type` do formato, `Cache-Control`
 * (default `"no-store"`) e `Content-Disposition` com `attachment`/`inline` + nome de arquivo
 * (ASCII saneado + UTF-8 real via `filename*`).
 */
export function reportResponse(options: ReportResponseOptions): Response {
  const { body, format, fileName, inline, cacheControl } = options;
  const fileNameWithExt = `${fileName}.${format}`;

  const headers = new Headers({
    "Content-Type": reportMimeTypes[format],
    "Cache-Control": cacheControl ?? "no-store",
    "Content-Disposition": buildContentDisposition(fileNameWithExt, inline),
  });

  // `@types/node` declara seu próprio `BodyInit`/`Uint8Array<ArrayBufferLike>` global (baseado no
  // `undici-types`), que conflita estruturalmente com o `Uint8Array` do lib "DOM" — mesmo tipo de
  // atrito entre libs já visto no `Buffer`/`LoadArg` de `xlsx/export-xlsx.test.ts`. Em runtime é
  // só um `Uint8Array`/`string`/`ReadableStream` normal, aceito direto pelo `Response`.
  return new Response(body as unknown as BodyInit, { headers });
}

/** Import dinâmico de `../pdf.js` com mensagem pt-BR melhorada quando o peer opcional
 *  `@react-pdf/renderer` não está instalado. */
async function loadPdfRenderer(): Promise<typeof import("../pdf.js")> {
  try {
    return await import("../pdf.js");
  } catch (err) {
    throw new Error(
      'O formato "pdf" requer o peer opcional @react-pdf/renderer. Instale-o com ' +
        "`npm install @react-pdf/renderer` para gerar relatórios em PDF.",
      { cause: err },
    );
  }
}

/** Import dinâmico de `../xlsx.js` com mensagem pt-BR melhorada quando o peer opcional
 *  `exceljs` não está instalado. */
async function loadXlsxExporter(): Promise<typeof import("../xlsx.js")> {
  try {
    return await import("../xlsx.js");
  } catch (err) {
    throw new Error(
      'O formato "xlsx" requer o peer opcional exceljs. Instale-o com ' +
        "`npm install exceljs` para gerar relatórios em XLSX.",
      { cause: err },
    );
  }
}

/** Gera o corpo do relatório no `format` pedido — csv/tsv/json direto do core (síncrono, zero
 *  peers), pdf/xlsx via import dinâmico do respectivo entry. */
async function renderReportBody<T>(
  input: ReportRenderInput<T>,
  format: ReportOutputFormat,
): Promise<Uint8Array | string> {
  switch (format) {
    case "csv":
      return exportReportToCsv(input);
    case "tsv":
      return exportReportToTsv(input);
    case "json":
      return exportReportToJson(input);
    case "pdf": {
      const { renderReportToBuffer } = await loadPdfRenderer();
      return renderReportToBuffer(input);
    }
    case "xlsx": {
      const { exportReportToXlsx } = await loadXlsxExporter();
      return exportReportToXlsx(input);
    }
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Formato de relatório não suportado: "${String(exhaustiveCheck)}".`);
    }
  }
}

export type RenderReportResponseInput<T> = ReportRenderInput<T> & {
  format: ReportOutputFormat;
  /** Default: `${definition.slug}-${generatedAt em aaaa-mm-dd}`. */
  fileName?: string;
  inline?: boolean;
  cacheControl?: string;
};

/**
 * Tudo-em-um: resolve o relatório, gera o corpo no `format` pedido (csv/tsv/json estáticos do
 * core; pdf/xlsx via `import()` dinâmico — assim os peers opcionais só carregam quando usados) e
 * devolve a `Response` já com os headers de `reportResponse`.
 */
export async function renderReportResponse<T>(
  input: RenderReportResponseInput<T>,
): Promise<Response> {
  const { format, fileName, inline, cacheControl, ...renderInput } = input;
  const generatedAt = renderInput.generatedAt ?? new Date();
  const finalInput: ReportRenderInput<T> = { ...renderInput, generatedAt };
  const resolvedFileName =
    fileName ?? `${finalInput.definition.slug}-${toIsoDateString(generatedAt)}`;

  const body = await renderReportBody(finalInput, format);

  return reportResponse({ body, format, fileName: resolvedFileName, inline, cacheControl });
}
