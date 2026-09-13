// @vitest-environment node
import { Rect, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";
import { readPdf, type PdfPageContent } from "../../tests/pdf.js";
import type { ReportDefinition, ReportPdfCellContext, ReportRenderInput } from "../core/types.js";
import {
  createReportDocument,
  renderReportToBuffer,
  renderReportToStream,
  type ReportPdfOptions,
} from "../pdf.js";
import { mmToPt } from "./map-columns.js";

type Row = { id: string; amount: number; team: string };

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `Row-${String(index).padStart(3, "0")}`,
    amount: index + 1,
    team: index === 1 || index === 6 ? "Equipe-B" : "Equipe-A",
  }));
}

function definition(overrides: Partial<ReportDefinition<Row>> = {}): ReportDefinition<Row> {
  return {
    slug: "blocos",
    name: "Relatorio em blocos",
    header: { subtitle: "Conferencia completa", showGeneratedAt: false, showPageNumbers: true },
    columns: [
      { key: "id", header: "Identificador", width: "65%" },
      { key: "amount", header: "Quantidade", width: "35%", format: "integer" },
    ],
    ...overrides,
  };
}

function texts(pages: PdfPageContent[]) {
  return pages.flatMap((page) => page.items.map((item) => item.text));
}

function rowIds(page: PdfPageContent) {
  return page.items.filter((item) => /^Row-\d{3}$/.test(item.text)).map((item) => item.text);
}

function expectGlobalFooters(pages: PdfPageContent[]) {
  pages.forEach((page, index) => {
    const counters = page.items.filter((item) => item.text.startsWith("Página "));
    expect(counters.map((item) => item.text)).toEqual([`Página ${index + 1} de ${pages.length}`]);
    expect(counters[0].y - counters[0].height).toBeGreaterThan(page.height - mmToPt(20));
    expect(counters[0].x + counters[0].width).toBeLessThanOrEqual(page.width - mmToPt(10) + 0.1);
  });
}

function expectTableHeaders(page: PdfPageContent, secondHeader = "Quantidade") {
  for (const label of [
    "Relatorio em blocos",
    "Conferencia completa",
    "Identificador",
    secondHeader,
  ]) {
    expect(page.items.filter((item) => item.text === label)).toHaveLength(1);
  }
  const subtitle = page.items.find((item) => item.text === "Conferencia completa")!;
  const header = page.items.find((item) => item.text === "Identificador")!;
  expect(header.y - header.height).toBeGreaterThan(subtitle.y);
  for (const item of page.items.filter((item) => /^Row-\d{3}$/.test(item.text))) {
    expect(item.y - item.height).toBeGreaterThan(header.y);
  }
}

async function collectStream(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    stream.on("error", reject);
  });
}

// Limites pequenos exercitam as quebras sem transformar a suíte em benchmark.
describe("blocos limitados do PDF", { timeout: 30_000 }, () => {
  const renderers = {
    buffer: renderReportToBuffer<Row>,
    stream: async (input: ReportRenderInput<Row>, options: ReportPdfOptions) =>
      collectStream(await renderReportToStream(input, options)),
    document: async (input: ReportRenderInput<Row>, options: ReportPdfOptions) =>
      renderToBuffer(createReportDocument(input, options) as Parameters<typeof renderToBuffer>[0]),
  };

  it.each(["buffer", "stream", "document"] as const)(
    "aplica o limite pelo segundo argumento na API %s",
    async (api) => {
      const data = rows(5);
      const pages = await readPdf(
        await renderers[api]({ definition: definition(), rows: data }, { maxRowsPerBlock: 2 }),
      );
      expect(pages.map(rowIds)).toEqual([
        data.slice(0, 2).map((row) => row.id),
        data.slice(2, 4).map((row) => row.id),
        [data[4].id],
      ]);
      pages.forEach((page) => expectTableHeaders(page));
      expectGlobalFooters(pages);
      expect(texts(pages).filter((text) => text === "Total")).toHaveLength(1);
    },
  );

  it("mantém o fluxo contínuo legado quando maxRowsPerBlock é false", async () => {
    const data = rows(7);
    const pages = await readPdf(
      await renderReportToBuffer(
        { definition: definition(), rows: data },
        { maxRowsPerBlock: false },
      ),
    );
    expect(pages).toHaveLength(1);
    expect(rowIds(pages[0])).toEqual(data.map((row) => row.id));
    expectGlobalFooters(pages);
  });

  it("usa 100 linhas por bloco quando a opção é omitida", async () => {
    const data = rows(101);
    const pages = await readPdf(
      await renderReportToBuffer({ definition: definition(), rows: data }),
    );
    expect(pages.length).toBeGreaterThan(2);
    expect(rowIds(pages[pages.length - 1])).toEqual([data[100].id]);
    expect(pages.flatMap(rowIds)).toEqual(data.map((row) => row.id));
    pages.forEach((page) => expectTableHeaders(page));
    expectGlobalFooters(pages);
  });

  it("preserva grupos maiores que um bloco, subtotais e callbacks com as linhas originais", async () => {
    const data = rows(9);
    const cell = vi.fn((ctx: ReportPdfCellContext<Row>) => <Text>{ctx.formatted}</Text>);
    const section = vi.fn((label: string, originalRows: Row[]) => {
      expect(originalRows).toBe(data);
      return <Text>{label}</Text>;
    });
    const def = definition({
      columns: [
        { key: "id", header: "Identificador", width: "65%", pdfRender: cell },
        { key: "amount", header: "Quantidade", width: "35%", format: "integer" },
      ],
      group: {
        by: "team",
        label: (key, grouped) => `${key} (${grouped.length})`,
        showSubtotal: true,
      },
      summary: [{ label: "Resumo dos itens", sourceColumn: "*", operation: "count" }],
      sections: [
        {
          id: "inicio",
          position: "before-table",
          pdfRender: (ctx) => section("Abertura unica", ctx.rows),
        },
        {
          id: "final",
          position: "after-table",
          pdfRender: (ctx) => section("Fechamento unico", ctx.rows),
        },
        {
          id: "assinatura",
          position: "after-summary",
          pdfRender: (ctx) => section("Assinatura unica", ctx.rows),
        },
      ],
    });
    const pages = await readPdf(
      await renderReportToBuffer({ definition: def, rows: data }, { maxRowsPerBlock: 3 }),
    );
    const all = texts(pages);
    const ordered = [
      ...data.filter((row) => row.team === "Equipe-A"),
      ...data.filter((row) => row.team === "Equipe-B"),
    ];
    expect(pages.flatMap(rowIds)).toEqual(ordered.map((row) => row.id));
    expect(pages.every((page) => rowIds(page).length <= 3)).toBe(true);
    for (const label of [
      "Equipe-A (7)",
      "Equipe-B (2)",
      "Total",
      "Abertura unica",
      "Fechamento unico",
      "Assinatura unica",
    ]) {
      expect(all.filter((text) => text === label)).toHaveLength(1);
    }
    expect(all.filter((text) => text.startsWith("Resumo dos itens"))).toHaveLength(1);
    expect(all.filter((text) => text === "Subtotal")).toHaveLength(2);
    const aggregateValues = pages.flatMap((page) =>
      page.items
        .filter((item) => item.text === "Subtotal" || item.text === "Total")
        .map((label) => ({
          label: label.text,
          values: page.items
            .filter((item) => item.x > label.x && Math.abs(item.y - label.y) < 0.1)
            .map((item) => item.text),
        })),
    );
    expect(aggregateValues).toEqual([
      { label: "Subtotal", values: ["36"] },
      { label: "Subtotal", values: ["9"] },
      { label: "Total", values: ["45"] },
    ]);
    expect(all.indexOf("Abertura unica")).toBeLessThan(all.indexOf(ordered[0].id));
    expect(all.indexOf("Fechamento unico")).toBeGreaterThan(
      all.indexOf(ordered[ordered.length - 1].id),
    );
    expect(all.findIndex((text) => text.startsWith("Resumo dos itens"))).toBeGreaterThan(
      all.indexOf("Fechamento unico"),
    );
    expect(all.indexOf("Assinatura unica")).toBeGreaterThan(
      all.findIndex((text) => text.startsWith("Resumo dos itens")),
    );
    expect(section).toHaveBeenCalledTimes(3);
    expect(cell.mock.calls.map(([ctx]) => ctx.row)).toEqual(ordered);
    cell.mock.calls.forEach(([ctx]) => {
      expect(data.includes(ctx.row)).toBe(true);
      expect(ctx.value).toBe(ctx.row.id);
      expect(ctx.formatted).toBe(ctx.row.id);
    });
    pages.filter((page) => rowIds(page).length > 0).forEach((page) => expectTableHeaders(page));
    expectGlobalFooters(pages);
  });

  it("repete cabeçalhos quando alturas variadas fazem um bloco continuar em outra página", async () => {
    const data = rows(6);
    const lineCounts = [5, 35, 27, 3, 22, 4];
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            columns: [
              { key: "id", header: "Identificador", width: "25%" },
              {
                key: "detail",
                header: "Descricao extensa",
                width: "75%",
                pdfRender: ({ row }) => (
                  <Text style={{ fontSize: 10 }}>
                    {Array.from(
                      { length: lineCounts[row.amount - 1] },
                      (_, line) =>
                        `Detalhe-${row.id}-${String(line).padStart(2, "0")} informacao complementar`,
                    ).join("\n")}
                  </Text>
                ),
              },
            ],
          }),
          rows: data,
        },
        { maxRowsPerBlock: 3 },
      ),
    );
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.flatMap(rowIds)).toEqual(data.map((row) => row.id));
    pages.forEach((page) => expectTableHeaders(page, "Descricao extensa"));
    for (const row of data) {
      const detailLines = texts(pages).filter((text) => text.startsWith(`Detalhe-${row.id}-`));
      expect(detailLines).toHaveLength(lineCounts[row.amount - 1]);
    }
    for (const page of pages) {
      const footer = page.items.find((item) => item.text.startsWith("Página "))!;
      for (const item of page.items.filter((item) => item.text.startsWith("Detalhe-"))) {
        expect(item.y).toBeLessThan(footer.y - footer.height);
      }
    }
    expectGlobalFooters(pages);
  });

  it("preserva zebra global entre grupos e barras SVG reais nas páginas de cada bloco", async () => {
    const data = rows(7);
    const ordered = [
      ...data.filter((row) => row.team === "Equipe-A"),
      ...data.filter((row) => row.team === "Equipe-B"),
    ];
    const ean = "4006381333931";
    // EAN-13 válido: dígito inicial 4 seleciona paridade LGLLGG.
    const left = [
      "0001101",
      "0011001",
      "0010011",
      "0111101",
      "0100011",
      "0110001",
      "0101111",
      "0111011",
      "0110111",
      "0001011",
    ];
    const even = [
      "0100111",
      "0110011",
      "0011011",
      "0100001",
      "0011101",
      "0111001",
      "0000101",
      "0010001",
      "0001001",
      "0010111",
    ];
    const pattern =
      "101" +
      [...ean.slice(1, 7)]
        .map((digit, index) => ("LGLLGG"[index] === "L" ? left : even)[Number(digit)])
        .join("") +
      "01010" +
      [...ean.slice(7)]
        .map((digit) => [...left[Number(digit)]].map((bit) => (bit === "1" ? "0" : "1")).join(""))
        .join("") +
      "101";
    expect(pattern).toHaveLength(95);
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            style: { zebraStripes: true },
            group: { by: "team", showSubtotal: false },
            columns: [
              { key: "id", header: "Identificador", width: "65%" },
              {
                key: "barcode",
                header: "EAN-13",
                width: "35%",
                pdfRender: () => (
                  <View>
                    <Svg width={115} height={32} viewBox="0 0 115 32">
                      <Rect x={0} y={0} width={115} height={32} fill="#ffffff" />
                      {[...pattern].map((bit, index) =>
                        bit === "1" ? (
                          <Rect
                            key={index}
                            x={10 + index}
                            y={0}
                            width={1}
                            height={32}
                            fill="#000000"
                          />
                        ) : null,
                      )}
                    </Svg>
                    <Text>{ean}</Text>
                  </View>
                ),
              },
            ],
          }),
          rows: data,
        },
        { maxRowsPerBlock: 3 },
      ),
      { rasterize: true },
    );
    expect(pages).toHaveLength(3);
    expect(pages.flatMap(rowIds)).toEqual(ordered.map((row) => row.id));
    for (const page of pages) {
      const raster = page.raster!;
      const pixel = (x: number, y: number) => {
        const offset =
          (Math.floor(y * raster.scale) * raster.width + Math.floor(x * raster.scale)) * 4;
        return Array.from(raster.pixels.slice(offset, offset + 3));
      };
      const labels = page.items.filter((item) => /^Row-\d{3}$/.test(item.text));
      for (const label of labels) {
        const index = ordered.findIndex((row) => row.id === label.text);
        expect(pixel(mmToPt(10) + 200, label.y - 3)).toEqual(
          index % 2 === 1 ? [245, 245, 245] : [255, 255, 255],
        );
      }
      const barcodes = page.items.filter((item) => item.text === ean);
      expect(barcodes).toHaveLength(labels.length);
      for (const barcode of barcodes) {
        for (let index = 0; index < pattern.length; index += 1) {
          const expected = pattern[index] === "1" ? 0 : 255;
          expect(pixel(barcode.x + 10 + index + 0.5, barcode.y - barcode.height - 16)).toEqual([
            expected,
            expected,
            expected,
          ]);
        }
      }
    }
  });

  it.each([58, 80] as const)(
    "mantém bobina %s mm contínua mesmo com limite de duas linhas",
    async (width) => {
      const data = rows(7);
      const pages = await readPdf(
        await renderReportToBuffer(
          {
            definition: definition({
              name: "Cupom",
              header: { showGeneratedAt: false, showPageNumbers: false },
              style: { headerFontSize: 8 },
              summary: [{ label: "Itens", sourceColumn: "*", operation: "count" }],
            }),
            rows: data,
            globalConfig: { paperSize: `${width}mm`, footerText: "Obrigado" },
          },
          { maxRowsPerBlock: 2 },
        ),
      );
      expect(pages).toHaveLength(1);
      const page = pages[0];
      expect(page.width).toBeCloseTo(mmToPt(width), 2);
      expect(rowIds(page)).toEqual(data.map((row) => row.id));
      expect(page.items.filter((item) => item.text === "Identificador")).toHaveLength(1);
      const lastRow = page.items.find((item) => item.text === data[6].id)!;
      const summary = page.items.find((item) => item.text.startsWith("Itens"))!;
      const footer = page.items.find((item) => item.text === "Obrigado")!;
      expect(summary.y).toBeGreaterThan(lastRow.y);
      expect(footer.y).toBeGreaterThan(summary.y);
      expect(footer.y).toBeLessThan(page.height);
    },
  );
});
