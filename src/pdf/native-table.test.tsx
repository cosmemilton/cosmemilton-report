// @vitest-environment node
import { Fragment } from "react";
import { Link, Rect, Svg, Text, View, renderToBuffer, renderToStream } from "@react-pdf/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readPdf, type PdfPageContent } from "../../tests/pdf.js";
import type { ReportDefinition, ReportRenderInput, ReportSection } from "../core/types.js";
import { renderReportToBuffer, renderReportToStream } from "../pdf.js";
import { prepareReportPdf } from "./create-document.js";
import { mmToPt } from "./map-columns.js";
import { createNativeReportPlan } from "./native-plan.js";
import { renderNativeReportToBuffer } from "./native-render.js";

// Isolado neste arquivo: verifica a escolha real do servidor, mantendo o renderer
// original disponível nos casos que devem preservar a compatibilidade.
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const renderer = await importOriginal<typeof import("@react-pdf/renderer")>();
  return {
    ...renderer,
    renderToBuffer: vi.fn(renderer.renderToBuffer),
    renderToStream: vi.fn(renderer.renderToStream),
  };
});

type Product = {
  code: string;
  description: string;
  ncm: string;
  price: number;
  st: string;
  tax: number;
  pis: string;
  stock: number;
  gondola: number;
  secret: string;
};
const data: Product[] = Array.from({ length: 5 }, (_, index) => ({
  code: `P${String(index + 1).padStart(5, "0")}`,
  description: `Açúcar e café São João ${index + 1}\nEmbalagem econômica`,
  ncm: "0901.21.00",
  price: 12.5,
  st: "060",
  tax: 0.185,
  pis: "01",
  stock: 1234.5,
  gondola: 42,
  secret: `NAO_EXIBIR_DADO_${index}`,
}));
function definition(overrides: Partial<ReportDefinition<Product>> = {}): ReportDefinition<Product> {
  return {
    slug: "produtos-nativos",
    name: "Relatório de produtos",
    header: { subtitle: "Loja São João", showGeneratedAt: false, showPageNumbers: true },
    columns: [
      { key: "code", header: "Código", width: "12%" },
      { key: "description", header: "Descrição", width: "28%" },
      { key: "ncm", header: "NCM", width: "10%" },
      { key: "price", header: "Preço", width: "10%", format: "currency" },
      { key: "st", header: "ST", width: "5%" },
      { key: "tax", header: "ICMS", width: "7%", format: "percent", noTotal: true },
      { key: "pis", header: "PIS", width: "7%" },
      { key: "stock", header: "Estoque", width: "11%", format: "number" },
      { key: "gondola", header: "Gôndola", width: "10%", format: "integer" },
    ],
    ...overrides,
  };
}
const allTexts = (pages: PdfPageContent[]) =>
  pages.flatMap((page) => page.items.map((item) => item.text));
const compact = (text: string) => text.replace(/\s/g, "");
const rowCodes = (page: PdfPageContent) =>
  page.items.filter((item) => /^P\d{5}$/.test(item.text)).map((item) => item.text);
function expectNative() {
  expect(renderToBuffer).not.toHaveBeenCalled();
  expect(renderToStream).not.toHaveBeenCalled();
}
function expectPageNumbers(pages: PdfPageContent[]) {
  pages.forEach((page, index) => {
    const counters = page.items.filter((item) => item.text.startsWith("Página "));
    expect(counters.map((item) => item.text)).toEqual([`Página ${index + 1} de ${pages.length}`]);
    expect(counters[0].y).toBeGreaterThan(page.height - mmToPt(20));
    expect(counters[0].x + counters[0].width).toBeLessThanOrEqual(page.width - mmToPt(10) + 0.1);
  });
}

afterEach(() => vi.clearAllMocks());

describe("tabelas nativas nas APIs de servidor", { timeout: 30_000 }, () => {
  it.each([
    ["A4", "portrait", 595.28, 841.89],
    ["A4", "landscape", 841.89, 595.28],
    ["Letter", "portrait", 612, 792],
    ["Letter", "landscape", 792, 612],
  ] as const)(
    "preserva nove colunas, formatação e paginação em %s/%s",
    async (paperSize, orientation, width, height) => {
      const pages = await readPdf(
        await renderReportToBuffer(
          {
            definition: definition(),
            rows: data,
            globalConfig: { paperSize, orientation, marginLeftMm: 12, marginRightMm: 14 },
          },
          { maxRowsPerBlock: 2 },
        ),
      );
      expectNative();
      expect(pages.map(rowCodes)).toEqual([
        [data[0].code, data[1].code],
        [data[2].code, data[3].code],
        [data[4].code],
      ]);
      pages.forEach((page) => {
        expect(page.width).toBeCloseTo(width, 1);
        expect(page.height).toBeCloseTo(height, 1);
        const subtitle = page.items.find((item) => item.text === "Loja São João")!;
        const firstRow = page.items.find((item) => /^P\d{5}$/.test(item.text))!;
        const headers = page.items.filter(
          (item) => item.y > subtitle.y && item.y < firstRow.y - firstRow.height,
        );
        // Colunas estreitas podem quebrar o cabeçalho em mais de uma linha.
        expect(compact(headers.map((item) => item.text).join(""))).toBe(
          compact(
            definition()
              .columns.map((column) => column.header)
              .join(""),
          ),
        );
        expect(page.items.filter((item) => item.text === "Relatório de produtos")).toHaveLength(1);
        for (const item of page.items.filter((item) => /^P\d{5}$/.test(item.text))) {
          expect(item.x).toBeGreaterThanOrEqual(mmToPt(12));
        }
        headers.forEach((item) =>
          expect(item.x + item.width).toBeLessThanOrEqual(page.width - mmToPt(14) + 0.1),
        );
      });
      const text = allTexts(pages),
        normalized = text.map(compact);
      for (const row of data) expect(text).toContain(row.description.split("\n")[0]);
      expect(text.filter((value) => value === "Embalagem econômica")).toHaveLength(5);
      expect(normalized.filter((value) => value === "R$12,50")).toHaveLength(5);
      expect(normalized.filter((value) => value === "18,50%")).toHaveLength(5);
      expect(normalized.filter((value) => value === "1.234,50")).toHaveLength(5);
      expect(text.filter((value) => value === "Total")).toHaveLength(1);
      expect(normalized).toContain("R$62,50");
      expect(normalized).toContain("6.172,50");
      expect(text).toContain("210");
      expectPageNumbers(pages);
    },
  );

  it("não exporta cabeçalho nem dados de colunas ocultas pela view", async () => {
    const input: ReportRenderInput<Product> = {
      definition: definition({
        columns: [...definition().columns, { key: "secret", header: "SEGREDO_INTERNO" }],
      }),
      rows: data,
      view: {
        id: "sem-segredo",
        slug: "produtos-nativos",
        name: "Pública",
        isSystem: false,
        isDefault: true,
        columns: [{ key: "secret", visible: false }],
      },
    };
    expect(createNativeReportPlan(prepareReportPdf(input))).not.toBeNull();
    const pages = await readPdf(await renderReportToBuffer(input, { maxRowsPerBlock: 2 }));
    expectNative();
    expect(pages.flatMap(rowCodes)).toEqual(data.map((row) => row.code));
    expect(allTexts(pages).join(" ")).not.toMatch(/SEGREDO_INTERNO|NAO_EXIBIR_DADO/);
  });

  it("mede alturas variadas e continua o bloco com todos os textos e cabeçalhos", async () => {
    const lineCounts = [3, 40, 34, 2, 8];
    const rows = data.map((row, index) => ({
      ...row,
      description: Array.from(
        { length: lineCounts[index] },
        (_, line) => `Texto-${index}-${String(line).padStart(2, "0")}`,
      ).join("\n"),
    }));
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            columns: [
              { key: "code", header: "Código", width: "20%" },
              { key: "description", header: "Descrição", width: "80%" },
            ],
          }),
          rows,
        },
        { maxRowsPerBlock: 3 },
      ),
    );
    expectNative();
    expect(pages).toHaveLength(3);
    expect(pages.flatMap(rowCodes)).toEqual(rows.map((row) => row.code));
    const text = allTexts(pages);
    rows.forEach((row) =>
      row.description
        .split("\n")
        .forEach((line) => expect(text.filter((item) => item === line)).toHaveLength(1)),
    );
    pages.forEach((page) => {
      expect(page.items.filter((item) => item.text === "Código")).toHaveLength(1);
      expect(page.items.filter((item) => item.text === "Descrição")).toHaveLength(1);
      const header = page.items.find((item) => item.text === "Descrição")!;
      for (const item of page.items.filter((item) => item.text.startsWith("Texto-"))) {
        expect(item.y - item.height).toBeGreaterThan(header.y);
        expect(item.y).toBeLessThan(page.height - mmToPt(10));
      }
    });
    expectPageNumbers(pages);
  });

  it("mantém o total numérico quando a primeira coluna também agrega", async () => {
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            columns: [
              { key: "gondola", header: "Gôndola", format: "integer" },
              { key: "code", header: "Código" },
            ],
          }),
          rows: data.slice(0, 3),
        },
        { maxRowsPerBlock: 2 },
      ),
    );
    expectNative();
    expect(allTexts(pages).filter((text) => text === "126")).toHaveLength(1);
    expect(allTexts(pages)).not.toContain("Total");
  });

  it("preserva textos, ordem, margens e borda das seções sem achatar o layout", async () => {
    const before = vi.fn(() => (
      <Fragment>
        <View style={{ marginBottom: 11 }}>
          <Text style={{ fontSize: 9, marginBottom: 5 }}>Filtro: produtos ativos</Text>
          <Text>Loja 0002 · Colaborador 99</Text>
        </View>
      </Fragment>
    ));
    const after = vi.fn(() => (
      <View
        wrap={false}
        style={{ marginTop: 13, paddingTop: 7, borderTopWidth: 2, borderTopColor: "#ff0000" }}
      >
        <Text style={{ fontSize: 9 }}>Conferência final: cinco produtos</Text>
      </View>
    ));
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            sections: [
              { id: "filtros", position: "before-table", pdfRender: before },
              { id: "conferencia", position: "after-table", pdfRender: after },
              {
                id: "assinatura",
                position: "after-summary",
                pdfRender: () => <Text>Responsável: João</Text>,
              },
            ],
          }),
          rows: data,
        },
        { maxRowsPerBlock: 3 },
      ),
      { rasterize: true },
    );
    expectNative();
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    const text = allTexts(pages);
    for (const label of [
      "Filtro: produtos ativos",
      "Loja 0002 · Colaborador 99",
      "Conferência final: cinco produtos",
      "Responsável: João",
    ]) {
      expect(text.filter((item) => item === label)).toHaveLength(1);
    }
    expect(text.indexOf("Filtro: produtos ativos")).toBeLessThan(text.indexOf(data[0].code));
    expect(text.indexOf("Conferência final: cinco produtos")).toBeGreaterThan(
      text.indexOf(data[4].code),
    );
    expect(text.indexOf("Responsável: João")).toBeGreaterThan(
      text.indexOf("Conferência final: cinco produtos"),
    );
    const first = pages[0],
      last = pages[pages.length - 1];
    const filters = first.items.find((item) => item.text === "Loja 0002 · Colaborador 99")!;
    const header = first.items.find((item) => item.text === "Código")!;
    expect(header.y - header.height - filters.y).toBeGreaterThan(9);
    const total = last.items.find((item) => item.text === "Total")!;
    const closing = last.items.find((item) => item.text === "Conferência final: cinco produtos")!;
    expect(closing.y - closing.height - total.y).toBeGreaterThan(18);
    const raster = last.raster!;
    const x = Math.round((last.width / 2) * raster.scale);
    const redRows: number[] = [];
    for (
      let y = Math.floor(total.y * raster.scale);
      y < Math.ceil(closing.y * raster.scale);
      y += 1
    ) {
      const offset = (y * raster.width + x) * 4;
      if (
        raster.pixels[offset] > 240 &&
        raster.pixels[offset + 1] < 20 &&
        raster.pixels[offset + 2] < 20
      )
        redRows.push(y);
    }
    expect(redRows.length).toBeGreaterThanOrEqual(2);
    expect(redRows.at(-1)! / raster.scale).toBeLessThan(closing.y - closing.height);
    pages.forEach((page) => {
      for (const item of page.items.filter((item) => /^P\d{5}$/.test(item.text))) {
        const index = data.findIndex((row) => row.code === item.text),
          pixels = page.raster!;
        const px = Math.round((mmToPt(10) + 1) * pixels.scale);
        const py = Math.round((item.y - item.height / 2) * pixels.scale);
        const offset = (py * pixels.width + px) * 4;
        expect(Array.from(pixels.pixels.subarray(offset, offset + 3))).toEqual(
          index % 2 ? [245, 245, 245] : [255, 255, 255],
        );
      }
    });
  });

  it("entrega stream PDF válido sem acionar o renderer React", async () => {
    const stream = await renderReportToStream(
      { definition: definition(), rows: data },
      { maxRowsPerBlock: 2 },
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = await readPdf(bytes);
    expectNative();
    expect(pages.flatMap(rowCodes)).toEqual(data.map((row) => row.code));
    expectPageNumbers(pages);
  });

  it.each([
    { engine: "react-pdf" as const, maxRowsPerBlock: 2 },
    { maxRowsPerBlock: false as const },
  ])("preserva a escolha explícita pelo renderer original: %j", async (options) => {
    const pages = await readPdf(
      await renderReportToBuffer({ definition: definition(), rows: data }, options),
    );
    expect(renderToBuffer).toHaveBeenCalled();
    expect(pages.flatMap(rowCodes)).toEqual(data.map((row) => row.code));
    if (options.maxRowsPerBlock === false) expect(pages).toHaveLength(1);
    expectPageNumbers(pages);
  });

  it("recusa a via nativa no Node 18 antes de carregar PDFKit", async () => {
    const original = Object.getOwnPropertyDescriptor(process.versions, "node")!;
    const prepared = prepareReportPdf({ definition: definition(), rows: data });
    try {
      Object.defineProperty(process.versions, "node", { ...original, value: "18.20.8" });
      expect(await renderNativeReportToBuffer(prepared)).toBeNull();
    } finally {
      Object.defineProperty(process.versions, "node", original);
    }
    expectNative();
  });
});

describe("seleção conservadora do renderer nativo", () => {
  const section = (pdfRender: ReportSection<Product>["pdfRender"]): ReportDefinition<Product> =>
    definition({ sections: [{ id: "custom", position: "before-table", pdfRender }] });
  const cases: [string, ReportRenderInput<Product>][] = [
    [
      "fonte personalizada",
      { definition: definition(), rows: data, globalConfig: { fontFamily: "FonteDoCliente" } },
    ],
    [
      "logo",
      {
        definition: definition({ header: { showLogo: true } }),
        rows: data,
        globalConfig: { showLogo: true, logoUrl: "data:image/png;base64,AA==" },
      },
    ],
    [
      "grupos e subtotais",
      { definition: definition({ group: { by: "st", showSubtotal: true } }), rows: data },
    ],
    [
      "resumo calculado",
      {
        definition: definition({
          summary: [{ label: "Produtos", sourceColumn: "*", operation: "count" }],
        }),
        rows: data,
      },
    ],
    [
      "código de barras SVG",
      {
        definition: definition({
          columns: [
            {
              key: "code",
              header: "Barras",
              pdfRender: () => (
                <Svg width={20} height={20}>
                  <Rect x={0} y={0} width={3} height={20} />
                </Svg>
              ),
            },
          ],
        }),
        rows: data,
      },
    ],
    [
      "seção dinâmica",
      {
        definition: section(() => <Text render={({ pageNumber }) => `Página ${pageNumber}`} />),
        rows: data,
      },
    ],
    ["seção fixa", { definition: section(() => <Text fixed>Carimbo</Text>), rows: data }],
    [
      "link interno",
      { definition: section(() => <Link src="#assinatura">Assinatura</Link>), rows: data },
    ],
    [
      "destino interno",
      { definition: section(() => <Text id="assinatura">Assinatura</Text>), rows: data },
    ],
    [
      "Text aninhado",
      {
        definition: section(() => (
          <Text>
            Parte <Text style={{ fontWeight: "bold" }}>importante</Text>
          </Text>
        )),
        rows: data,
      },
    ],
    [
      "layout horizontal",
      {
        definition: section(() => (
          <View style={{ flexDirection: "row" }}>
            <Text>Esquerda</Text>
            <Text>Direita</Text>
          </View>
        )),
        rows: data,
      },
    ],
    [
      "estilo de texto desconhecido",
      { definition: section(() => <Text style={{ letterSpacing: 2 }}>Espaçado</Text>), rows: data },
    ],
    [
      "alfabeto fora da fonte padrão",
      { definition: definition(), rows: [{ ...data[0], description: "Продукт" }] },
    ],
    ["bobina 58mm", { definition: definition(), rows: data, globalConfig: { paperSize: "58mm" } }],
    ["bobina 80mm", { definition: definition(), rows: data, globalConfig: { paperSize: "80mm" } }],
  ];
  it.each(cases)("preserva o caminho React para %s", (_label, input) => {
    expect(createNativeReportPlan(prepareReportPdf(input, { maxRowsPerBlock: 2 }))).toBeNull();
  });

  it("não executa componentes opacos durante a seleção", () => {
    const Custom = vi.fn(() => <Text>Componente do cliente</Text>);
    expect(
      createNativeReportPlan(
        prepareReportPdf({ definition: section(() => <Custom />), rows: data }),
      ),
    ).toBeNull();
    expect(Custom).not.toHaveBeenCalled();
  });
});
