// Repro portatil: executar apos npm run build. Sem banco, browser ou servico externo.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderReportToBuffer } from "../dist/pdf.js";

const rows = [
  { code: "A-01", group: "A", value: 1 },
  { code: "A-02", group: "A", value: 2 },
  { code: "B-01", group: "B", value: 4 },
];
const definition = {
  slug: "repro-break-before-row",
  name: "Repro paginas globais",
  header: { subtitle: "Dois grupos desiguais", showGeneratedAt: false },
  columns: [
    { key: "code", header: "Codigo", width: "70%" },
    { key: "value", header: "Valor", width: "30%", format: "integer" },
  ],
};
const base = process.argv[2] ?? tmpdir();
await mkdir(base, { recursive: true });
const output = await mkdtemp(join(base, "cosmemilton-report-row-break-"));
const resultados = [];
for (const [engine, maxRowsPerBlock] of [
  ["auto", 100],
  ["react-pdf", false],
]) {
  const calls = [];
  const bytes = await renderReportToBuffer(
    { definition, rows },
    {
      engine,
      maxRowsPerBlock,
      breakBeforeRow: (row, index) => {
        calls.push([row.code, index]);
        return index === 0 || (index > 0 && row.group !== rows[index - 1].group);
      },
    },
  );
  assert.deepEqual(
    calls,
    rows.map((row, index) => [row.code, index]),
  );
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(pdf.getPageCount(), 2, "Quebra por grupo requer duas paginas");
  if (engine === "auto") assert.match(pdf.getProducer(), /PDFKit/);
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: fileURLToPath(
      new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
    ),
  });
  const parsed = await task.promise;
  try {
    for (let i = 1; i <= 2; i++) {
      const page = await parsed.getPage(i);
      const content = (await page.getTextContent()).items.map((item) => item.str);
      assert.deepEqual(
        content.filter((text) => /^[AB]-\d{2}$/.test(text)),
        i === 1 ? ["A-01", "A-02"] : ["B-01"],
      );
      assert.deepEqual(
        content.filter((text) => text.startsWith("Página ")),
        [`Página ${i} de 2`],
      );
      for (const text of ["Codigo", "Valor", "Repro paginas globais"])
        assert.equal(content.filter((item) => item === text).length, 1);
      assert.equal(content.filter((text) => text === "Total").length, i === 2 ? 1 : 0);
    }
  } finally {
    await parsed.destroy();
  }
  const arquivo = join(output, `${engine}-${maxRowsPerBlock}.pdf`);
  await writeFile(arquivo, bytes);
  resultados.push({
    engine,
    maxRowsPerBlock,
    paginas: pdf.getPageCount(),
    bytes: bytes.length,
    producer: pdf.getProducer(),
    arquivo,
  });
}
console.log(JSON.stringify({ resultado: "aprovado", resultados }, null, 2));
