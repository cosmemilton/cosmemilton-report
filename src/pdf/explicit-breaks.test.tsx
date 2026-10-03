// @vitest-environment node
import { Text, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { readPdf, type PdfPageContent } from "../../tests/pdf.js";
import type { ReportDefinition, ReportRenderInput } from "../core/types.js";
import { createReportDocument, renderReportToBuffer, renderReportToStream } from "../pdf.js";
import { prepareReportPdf } from "./create-document.js";

type Row = { code: string; group: string; amount: number };
const data: Row[] = [
  { code: "Item-A1", group: "A", amount: 1 },
  { code: "Item-A2", group: "A", amount: 2 },
  { code: "Item-B1", group: "B", amount: 4 },
];
function definition(extra: Partial<ReportDefinition<Row>> = {}): ReportDefinition<Row> {
  return {
    slug: "quebras-explicitas",
    name: "Relatorio com quebras",
    header: { subtitle: "Periodo completo", showGeneratedAt: false },
    columns: [
      { key: "code", header: "Codigo", width: "70%" },
      { key: "amount", header: "Valor", width: "30%", format: "integer" },
    ],
    sections: [
      { id: "inicio", position: "before-table", pdfRender: () => <Text>Inicio unico</Text> },
      { id: "final", position: "after-table", pdfRender: () => <Text>Final unico</Text> },
    ],
    ...extra,
  };
}
const texts = (page: PdfPageContent) => page.items.map((item) => item.text);
const codes = (page: PdfPageContent) => texts(page).filter((text) => /^Item-/.test(text));
function check(pages: PdfPageContent[], expected: string[][]) {
  expect(pages.map(codes)).toEqual(expected);
  pages.forEach((page, index) => {
    const content = texts(page);
    for (const label of ["Relatorio com quebras", "Periodo completo", "Codigo", "Valor"])
      expect(content.filter((text) => text === label)).toHaveLength(1);
    expect(content.filter((text) => text.startsWith("Página "))).toEqual([
      `Página ${index + 1} de ${pages.length}`,
    ]);
  });
  const all = pages.flatMap(texts);
  for (const label of ["Inicio unico", "Final unico", "Total"])
    expect(all.filter((text) => text === label)).toHaveLength(1);
  expect(texts(pages[0])).toContain("Inicio unico");
  expect(texts(pages.at(-1)!)).toContain("Final unico");
  expect(texts(pages.at(-1)!)).toContain("Total");
}
const groupBoundary = (row: Row, index: number) => index === 0 || row.group === "B";

describe("quebra explicita antes de linha", { timeout: 30_000 }, () => {
  it.each(["auto", "react-pdf"] as const)(
    "preserva dois grupos desiguais, moldura e contador global no motor %s",
    async (engine) => {
      const callback = vi.fn(groupBoundary);
      const bytes = await renderReportToBuffer(
        { definition: definition(), rows: data },
        { engine, breakBeforeRow: callback },
      );
      check(await readPdf(bytes), [["Item-A1", "Item-A2"], ["Item-B1"]]);
      expect(callback.mock.calls).toEqual(data.map((row, index) => [row, index]));
      const producer = (await PDFDocument.load(bytes, { updateMetadata: false })).getProducer();
      if (engine === "auto") expect(producer).toContain("PDFKit");
      else expect(producer).not.toContain("PDFKit");
    },
  );

  it("mantem quebras explicitas e contador global com maxRowsPerBlock:false", async () => {
    const callback = vi.fn(groupBoundary);
    const bytes = await renderReportToBuffer(
      { definition: definition(), rows: data },
      { maxRowsPerBlock: false, breakBeforeRow: callback },
    );
    check(await readPdf(bytes), [["Item-A1", "Item-A2"], ["Item-B1"]]);
    expect(callback).toHaveBeenCalledTimes(data.length);
  });

  it("oferece a mesma quebra nas APIs document e stream", async () => {
    const input = { definition: definition(), rows: data };
    const options = { maxRowsPerBlock: false as const, breakBeforeRow: groupBoundary };
    const document = await renderToBuffer(
      createReportDocument(input, options) as Parameters<typeof renderToBuffer>[0],
    );
    check(await readPdf(document), [["Item-A1", "Item-A2"], ["Item-B1"]]);
    const stream = await renderReportToStream(input, { breakBeforeRow: groupBoundary });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    check(await readPdf(Buffer.concat(chunks)), [["Item-A1", "Item-A2"], ["Item-B1"]]);
  });

  it("preserva grupo acima de 100 linhas, sem perder dados ou criar pagina vazia", async () => {
    const rows = Array.from({ length: 103 }, (_, index) => ({
      code: `Item-${String(index).padStart(3, "0")}`,
      group: index < 101 ? "A" : "B",
      amount: 1,
    }));
    const bytes = await renderReportToBuffer(
      { definition: definition(), rows },
      { breakBeforeRow: (_row, index) => index === 101 },
    );
    const pages = await readPdf(bytes);
    expect(pages.flatMap(codes)).toEqual(rows.map((row) => row.code));
    expect(pages.every((page) => codes(page).length > 0)).toBe(true);
    expect(codes(pages.at(-1)!)).toEqual(["Item-101", "Item-102"]);
    pages.forEach((page, index) =>
      expect(texts(page).filter((text) => text.startsWith("Página "))).toEqual([
        `Página ${index + 1} de ${pages.length}`,
      ]),
    );
  });

  it.each([2, false] as const)(
    "mantem cabecalho de grupo junto da primeira linha, subtotais e total com limite %s",
    async (maxRowsPerBlock) => {
      const rows = [data[0], data[2], data[1]];
      const callback = vi.fn((row: Row, index: number) => index === 2 && row.group === "B");
      const bytes = await renderReportToBuffer(
        {
          definition: definition({ group: { by: "group", label: (key) => `Grupo ${key}` } }),
          rows,
        },
        { maxRowsPerBlock, breakBeforeRow: callback },
      );
      const pages = await readPdf(bytes);
      check(pages, [["Item-A1", "Item-A2"], ["Item-B1"]]);
      expect(texts(pages[0])).toContain("Grupo A");
      expect(texts(pages[1])).toContain("Grupo B");
      expect(pages.flatMap(texts).filter((text) => text === "Subtotal")).toHaveLength(2);
      expect(callback.mock.calls).toEqual([
        [rows[0], 0],
        [rows[2], 1],
        [rows[1], 2],
      ]);
    },
  );

  it("preserva quebra quando celula dinamica exige um unico contexto React", async () => {
    const callback = vi.fn(groupBoundary);
    const bytes = await renderReportToBuffer(
      {
        definition: definition({
          columns: [
            {
              key: "code",
              header: "Codigo",
              width: "70%",
              pdfRender: ({ formatted }) => (
                <Text render={({ pageNumber }) => `${formatted} p${pageNumber}`} />
              ),
            },
            { key: "amount", header: "Valor", width: "30%", format: "integer" },
          ],
        }),
        rows: data,
      },
      { maxRowsPerBlock: 1, breakBeforeRow: callback },
    );
    const pages = await readPdf(bytes);
    expect(pages).toHaveLength(2);
    expect(texts(pages[0])).toContain("Item-A1 p1");
    expect(texts(pages[0])).toContain("Item-A2 p1");
    expect(texts(pages[1])).toContain("Item-B1 p2");
    expect(callback).toHaveBeenCalledTimes(data.length);
    pages.forEach((page, index) =>
      expect(texts(page).filter((text) => text.startsWith("Página "))).toEqual([
        `Página ${index + 1} de 2`,
      ]),
    );
  });

  it("nao copia molduras de segmentos vizinhos em continuacoes e tres quebras explicitas", async () => {
    const rows = Array.from({ length: 189 }, (_, index) => ({
      code: `Item-${String(index).padStart(3, "0")}`,
      group: index < 180 ? "A" : index < 183 ? "B" : index < 186 ? "C" : "D",
      amount: 1,
    }));
    const callback = vi.fn((_row: Row, index: number) => [180, 183, 186].includes(index));
    const bytes = await renderReportToBuffer(
      { definition: definition(), rows },
      { maxRowsPerBlock: false, breakBeforeRow: callback },
    );
    const pages = await readPdf(bytes);
    expect(pages.flatMap(codes)).toEqual(rows.map((row) => row.code));
    expect(
      pages.filter((page) => codes(page).some((code) => Number(code.slice(5)) < 180)).length,
    ).toBeGreaterThan(2);
    for (const [index, expected] of [
      [180, 183],
      [183, 186],
      [186, 189],
    ]) {
      const page = pages.find((p) => codes(p).includes(rows[index].code))!;
      expect(codes(page)).toEqual(rows.slice(index, expected).map((row) => row.code));
    }
    pages.forEach((page, index) => {
      for (const header of ["Relatorio com quebras", "Periodo completo", "Codigo", "Valor"])
        expect(texts(page).filter((text) => text === header)).toHaveLength(1);
      expect(codes(page).length).toBeGreaterThan(0);
      expect(texts(page).filter((text) => text.startsWith("Página "))).toEqual([
        `Página ${index + 1} de ${pages.length}`,
      ]);
    });
    const all = pages.flatMap(texts);
    for (const label of ["Inicio unico", "Final unico", "Total"])
      expect(all.filter((text) => text === label)).toHaveLength(1);
    expect(texts(pages[0])).toContain("Inicio unico");
    expect(texts(pages.at(-1)!)).toContain("Final unico");
    expect(texts(pages.at(-1)!)).toContain("Total");
    expect(callback.mock.calls).toEqual(rows.map((row, index) => [row, index]));
  });

  it.each(["58mm", "80mm"] as const)(
    "rejeita quebra explicita em %s e conserva bobina sem a opcao",
    async (paperSize) => {
      const input: ReportRenderInput<Row> = {
        definition: definition(),
        rows: data,
        globalConfig: { paperSize },
      };
      const callback = vi.fn(groupBoundary);
      expect(() => prepareReportPdf(input, { breakBeforeRow: callback })).toThrow(/bobinas/);
      expect(callback).not.toHaveBeenCalled();
      expect(await readPdf(await renderReportToBuffer(input))).toHaveLength(1);
    },
  );

  it.each([100, false] as const)(
    "nao cria paginas de dados invisiveis em relatorio somente sections, limite %s",
    async (maxRowsPerBlock) => {
      const callback = vi.fn(() => true);
      const bytes = await renderReportToBuffer(
        {
          definition: definition({
            columns: [{ key: "code", header: "Codigo", visible: false }],
          }),
          rows: data,
        },
        { maxRowsPerBlock, breakBeforeRow: callback },
      );
      const pages = await readPdf(bytes);
      expect(pages).toHaveLength(1);
      expect(callback).not.toHaveBeenCalled();
      expect(texts(pages[0])).toContain("Inicio unico");
      expect(texts(pages[0])).toContain("Final unico");
      expect(texts(pages[0])).toContain("Página 1 de 1");
      expect(texts(pages[0])).not.toContain("Codigo");
      expect(codes(pages[0])).toEqual([]);
    },
  );

  it("mantem fluxo original para callbackfalse e dados vazios, e propaga erro antes de renderizar", async () => {
    const callback = vi.fn(() => false);
    const pages = await readPdf(
      await renderReportToBuffer(
        { definition: definition(), rows: data },
        { breakBeforeRow: callback },
      ),
    );
    check(pages, [data.map((row) => row.code)]);
    expect(callback).toHaveBeenCalledTimes(data.length);
    callback.mockClear();
    expect(
      await readPdf(
        await renderReportToBuffer(
          { definition: definition(), rows: [] },
          { breakBeforeRow: callback },
        ),
      ),
    ).toHaveLength(1);
    expect(callback).not.toHaveBeenCalled();
    const error = new Error("Erro do callback");
    await expect(
      renderReportToBuffer(
        { definition: definition(), rows: data },
        {
          breakBeforeRow: () => {
            throw error;
          },
        },
      ),
    ).rejects.toBe(error);
  });
});
