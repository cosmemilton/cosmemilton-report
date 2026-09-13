// @vitest-environment node
import { Link, Text } from "@react-pdf/renderer";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it, vi } from "vitest";
import { readPdf } from "../../tests/pdf.js";
import type { ReportDefinition, ReportPdfCellContext } from "../core/types.js";
import { registerReportFonts, renderReportToBuffer } from "../pdf.js";
import { mmToPt } from "./map-columns.js";

type Row = { id: string };
const data = Array.from({ length: 7 }, (_, index) => ({ id: `Produto-${index + 1}` }));
const definition = (overrides: Partial<ReportDefinition<Row>> = {}): ReportDefinition<Row> => ({
  slug: "merge-servidor",
  name: "Relatorio combinado",
  header: { showGeneratedAt: false, showPageNumbers: true },
  columns: [{ key: "id", header: "Produto" }],
  ...overrides,
});

const standardFontDataUrl = fileURLToPath(
  new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
);
const loadPdf = (bytes: Uint8Array) =>
  getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl,
    useSystemFonts: true,
    fontExtraProperties: true,
  });

describe("PDF combinado pelas APIs de servidor", { timeout: 30_000 }, () => {
  it("preserva fonte incorporada, acentos e alinhamento do rodapé após unir os blocos", async () => {
    registerReportFonts({
      family: "MergeRegressionSans",
      fonts: [
        { src: standardFontDataUrl + "LiberationSans-Regular.ttf", fontWeight: "normal" },
        { src: standardFontDataUrl + "LiberationSans-Bold.ttf", fontWeight: "bold" },
      ],
    });
    const footerText = "Loja São João · Δ Ж";
    const bytes = await renderReportToBuffer(
      {
        definition: definition({ style: { fontSize: 11 } }),
        rows: data.slice(0, 5),
        globalConfig: { fontFamily: "MergeRegressionSans", footerText, marginBottomMm: 16 },
      },
      { maxRowsPerBlock: 2 },
    );
    const pages = await readPdf(bytes);
    expect(pages).toHaveLength(3);
    const task = loadPdf(bytes);
    const document = await task.promise;
    try {
      expect((await document.getMetadata()).info).toMatchObject({ Title: "Relatorio combinado" });
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const footerParts = page.items.filter(
          (item) => item.text.startsWith("Loja ") || item.text === "Δ" || item.text === "Ж",
        );
        const counters = page.items.filter((item) => item.text.startsWith("Página "));
        expect(footerParts.map((item) => item.text).join(" ")).toBe(footerText);
        expect(counters.map((item) => item.text)).toEqual([`Página ${index + 1} de 3`]);
        const footer = footerParts[0],
          counter = counters[0];
        expect(footer.height).toBeCloseTo(10, 1);
        expect(counter.height).toBeCloseTo(10, 1);
        expect(footer.y).toBeCloseTo(counter.y, 1);
        expect(footer.x).toBeCloseTo(mmToPt(10), 1);
        expect(counter.x + counter.width).toBeCloseTo(page.width - mmToPt(10), 1);
        expect(footer.y).toBeGreaterThan(
          Math.max(
            ...page.items.filter((item) => item.text.startsWith("Produto-")).map((item) => item.y),
          ),
        );

        const actual = await document.getPage(index + 1);
        const content = await actual.getTextContent();
        await actual.getOperatorList();
        const footerItems = content.items.filter(
          (item) =>
            "str" in item &&
            (item.str.startsWith("Loja ") ||
              item.str.trim() === "Δ" ||
              item.str.trim() === "Ж" ||
              item.str.startsWith("Página ")),
        );
        expect(footerItems.length).toBeGreaterThanOrEqual(2);
        for (const item of footerItems) {
          if (!("fontName" in item)) throw new Error("Rodapé sem fonte no PDF emitido");
          const font = actual.commonObjs.get(item.fontName) as {
            name: string;
            missingFile: boolean;
            data: Uint8Array | null;
          };
          expect(font.name).toContain("LiberationSans");
          expect(font.missingFile).toBe(false);
          expect(font.data?.length).toBeGreaterThan(0);
        }
      }
    } finally {
      await task.destroy();
    }
  });

  it("não reintroduz números desativados nem duplica o texto fixo do rodapé", async () => {
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({ header: { showGeneratedAt: false, showPageNumbers: false } }),
          rows: data,
          globalConfig: { footerText: "Fim do documento" },
        },
        { maxRowsPerBlock: 2, engine: "react-pdf" },
      ),
    );
    expect(pages).toHaveLength(4);
    for (const page of pages) {
      expect(page.items.filter((item) => item.text === "Fim do documento")).toHaveLength(1);
      expect(page.items.some((item) => item.text.startsWith("Página "))).toBe(false);
    }
  });

  it("mantém a numeração global ao atravessar um lote de cinquenta rodapés", async () => {
    const manyRows = Array.from({ length: 51 }, (_, index) => ({ id: `Linha-${index + 1}` }));
    const pages = await readPdf(
      await renderReportToBuffer(
        { definition: definition(), rows: manyRows },
        { maxRowsPerBlock: 1, engine: "react-pdf" },
      ),
    );
    expect(pages).toHaveLength(51);
    pages.forEach((page, index) => {
      expect(
        page.items.filter((item) => item.text.startsWith("Página ")).map((item) => item.text),
      ).toEqual([`Página ${index + 1} de 51`]);
      expect(
        page.items.filter((item) => item.text.startsWith("Linha-")).map((item) => item.text),
      ).toEqual([manyRows[index].id]);
    });
  });

  it("mantém sections dinâmicas no fluxo contínuo com a contagem global correta", async () => {
    const cell = vi.fn((ctx: ReportPdfCellContext<Row>) => (
      <Text style={{ height: 120 }}>{ctx.row.id}</Text>
    ));
    const section = vi.fn(() => (
      <Text render={({ pageNumber, totalPages }) => `Anexo ${pageNumber}/${totalPages}`} />
    ));
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            columns: [{ key: "id", header: "Produto", pdfRender: cell }],
            sections: [{ id: "anexo", position: "after-table", pdfRender: section }],
          }),
          rows: data,
        },
        { maxRowsPerBlock: 2 },
      ),
    );
    expect(pages).toHaveLength(2);
    expect(
      pages.flatMap((page) =>
        page.items.filter((item) => item.text.startsWith("Anexo ")).map((item) => item.text),
      ),
    ).toEqual(["Anexo 2/2"]);
    expect(section).toHaveBeenCalledOnce();
    expect(cell.mock.calls.map(([ctx]) => ctx.row)).toEqual(data);
    pages.forEach((page, index) =>
      expect(
        page.items.filter((item) => item.text.startsWith("Página ")).map((item) => item.text),
      ).toEqual([`Página ${index + 1} de 2`]),
    );
  });

  it("preserva links internos e o destino em outra página usando o fallback contínuo", async () => {
    const opening = vi.fn(() => <Link src="#assinatura">Ir para assinatura</Link>);
    const closing = vi.fn(() => (
      <Text id="assinatura" break>
        Assinatura final
      </Text>
    ));
    const bytes = await renderReportToBuffer(
      {
        definition: definition({
          sections: [
            { id: "abertura", position: "before-table", pdfRender: opening },
            { id: "fim", position: "after-table", pdfRender: closing },
          ],
        }),
        rows: data,
      },
      { maxRowsPerBlock: 2 },
    );
    const pages = await readPdf(bytes);
    expect(pages).toHaveLength(2);
    expect(pages[1].items.some((item) => item.text === "Assinatura final")).toBe(true);
    expect(opening).toHaveBeenCalledOnce();
    expect(closing).toHaveBeenCalledOnce();
    const task = loadPdf(bytes);
    const document = await task.promise;
    try {
      const first = await document.getPage(1);
      const links = (await first.getAnnotations()).filter(
        (annotation) => annotation.subtype === "Link",
      );
      expect(links).toHaveLength(1);
      expect(links[0].dest).toBe("assinatura");
      const destination = await document.getDestination("assinatura");
      expect(destination).not.toBeNull();
      expect(await document.getPageIndex(destination![0])).toBe(1);
    } finally {
      await task.destroy();
    }
  });

  it("preserva render dinâmico dentro de células sem chamar pdfRender novamente", async () => {
    const cell = vi.fn((ctx: ReportPdfCellContext<Row>) => (
      <Text render={({ pageNumber, totalPages }) => `${ctx.row.id} ${pageNumber}/${totalPages}`} />
    ));
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({ columns: [{ key: "id", header: "Produto", pdfRender: cell }] }),
          rows: data,
        },
        { maxRowsPerBlock: 2 },
      ),
    );
    expect(pages).toHaveLength(1);
    expect(
      pages[0].items.filter((item) => item.text.startsWith("Produto-")).map((item) => item.text),
    ).toEqual(data.map((row) => `${row.id} 1/1`));
    expect(cell.mock.calls.map(([ctx]) => ctx.row)).toEqual(data);
  });

  it("mantém marca fixa encapsulada em componente próprio sem executá-lo na preparação", async () => {
    const Stamp = vi.fn(() => <Text fixed>Marca de conferencia</Text>);
    const section = vi.fn(() => <Stamp />);
    const pages = await readPdf(
      await renderReportToBuffer(
        {
          definition: definition({
            columns: [
              {
                key: "id",
                header: "Produto",
                pdfRender: ({ row }) => <Text style={{ height: 120 }}>{row.id}</Text>,
              },
            ],
            sections: [{ id: "marca", position: "before-table", pdfRender: section }],
          }),
          rows: data,
        },
        { maxRowsPerBlock: 2 },
      ),
    );
    expect(pages).toHaveLength(2);
    for (const page of pages)
      expect(page.items.filter((item) => item.text === "Marca de conferencia")).toHaveLength(1);
    expect(section).toHaveBeenCalledOnce();
    expect(Stamp).toHaveBeenCalledOnce();
  });
});
