// @vitest-environment node
import { Text } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { readPdf, type PdfPageContent } from "../../tests/pdf.js";
import type { ReportDefinition } from "../core/types.js";
import { renderReportToBuffer } from "./render.js";

type Row = { item: string; quantity: number; department: string };

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    item: `Item-${String(index).padStart(3, "0")}`,
    quantity: 1,
    department: index < count / 2 ? "Equipe-A" : "Equipe-B",
  }));
}

function definition(overrides: Partial<ReportDefinition<Row>> = {}): ReportDefinition<Row> {
  return {
    slug: "paginacao",
    name: "Relatorio paginado",
    header: { subtitle: "Conferencia de itens", showGeneratedAt: false },
    columns: [
      { key: "item", header: "Descricao", width: "65%" },
      { key: "quantity", header: "Quantidade", format: "integer", width: "35%" },
    ],
    ...overrides,
  };
}

function matching(page: PdfPageContent, text: string) {
  return page.items.filter((item) => item.text === text);
}

function expectHeaderAboveRows(page: PdfPageContent): void {
  const title = matching(page, "Relatorio paginado");
  const subtitle = matching(page, "Conferencia de itens");
  const headers = ["Descricao", "Quantidade"].map((text) => matching(page, text));
  const body = page.items.filter((item) => /^Item-\d{3}$/.test(item.text));
  expect(title).toHaveLength(1);
  expect(subtitle).toHaveLength(1);
  for (const header of headers) {
    expect(header).toHaveLength(1);
    // Altura é verificada no PDF real: cabeçalho não invade branding nem primeira linha.
    expect(header[0].y - header[0].height).toBeGreaterThan(subtitle[0].y);
    for (const item of body) {
      expect(item.y - item.height).toBeGreaterThan(header[0].y);
    }
  }
}

// Renderização e leitura de várias páginas competem com a suíte de UI no CI.
describe("cabeçalhos de coluna no PDF paginado", { timeout: 15_000 }, () => {
  it.each(["compact", "normal", "relaxed"] as const)(
    "repete os cabeçalhos abaixo do branding e acima dos dados com densidade %s",
    async (density) => {
      const data = rows(120);
      const pages = await readPdf(
        await renderReportToBuffer({
          definition: definition({ style: { density, showGridLines: true } }),
          rows: data,
        }),
      );

      expect(pages.length).toBeGreaterThan(2);
      for (const page of pages) {
        expectHeaderAboveRows(page);
      }
      const allItems = pages.flatMap((page) => page.items.map((item) => item.text));
      expect(allItems.filter((text) => /^Item-\d{3}$/.test(text))).toEqual(
        data.map((row) => row.item),
      );
    },
  );

  it("preserva agrupamento, subtotais e total quando a tabela atravessa páginas", async () => {
    const data = rows(120);
    const pages = await readPdf(
      await renderReportToBuffer({
        definition: definition({ group: { by: "department", showSubtotal: true } }),
        rows: data,
      }),
    );

    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) {
      expectHeaderAboveRows(page);
    }
    const allItems = pages.flatMap((page) => page.items.map((item) => item.text));
    expect(allItems.filter((text) => text === "Subtotal")).toHaveLength(2);
    expect(allItems.filter((text) => text === "Total")).toHaveLength(1);
    expect(allItems.filter((text) => text === "60")).toHaveLength(2);
    expect(allItems.filter((text) => text === "120")).toHaveLength(1);
    expect(allItems.filter((text) => text === "Equipe-A")).toHaveLength(1);
    expect(allItems.filter((text) => text === "Equipe-B")).toHaveLength(1);
    expect(allItems.filter((text) => /^Item-\d{3}$/.test(text))).toEqual(
      data.map((row) => row.item),
    );
  });

  it("reserva a altura de cabeçalhos multilinha com metadados de branding", async () => {
    const pages = await readPdf(
      await renderReportToBuffer({
        definition: definition({
          header: {
            subtitle: "Conferencia de itens",
            showGeneratedAt: true,
            showUserName: true,
          },
          columns: [
            { key: "item", header: "Descricao\ncomplementar", width: "65%" },
            { key: "quantity", header: "Quantidade\nvendida", format: "integer", width: "35%" },
          ],
        }),
        globalConfig: { companyName: "Empresa" },
        userName: "Operador",
        generatedAt: new Date("2026-09-13T10:00:00Z"),
        rows: rows(80),
      }),
    );

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expectHeaderAboveRows(page);
      const headers = ["complementar", "vendida"].map((text) => matching(page, text)[0]);
      expect(matching(page, "Empresa")).toHaveLength(1);
      const operator = matching(page, "Operador")[0];
      const firstHeader = matching(page, "Descricao")[0];
      expect(operator.y).toBeLessThan(firstHeader.y - firstHeader.height);
      const body = page.items.filter((item) => /^Item-\d/.test(item.text));
      for (const item of body) {
        for (const header of headers) {
          expect(item.y - item.height).toBeGreaterThan(header.y);
        }
      }
    }
  });

  it("mantém sections na ordem e limita os cabeçalhos às páginas da tabela", async () => {
    const pages = await readPdf(
      await renderReportToBuffer({
        definition: definition({
          summary: [{ label: "Itens conferidos", sourceColumn: "*", operation: "count" }],
          sections: [
            {
              id: "introducao",
              position: "before-table",
              pdfRender: () => <Text>Introducao</Text>,
            },
            {
              id: "instrucoes",
              position: "before-table",
              pdfRender: () => <Text break>Instrucoes da tabela</Text>,
            },
            {
              id: "anexo",
              position: "after-table",
              pdfRender: () => <Text break>Anexo final</Text>,
            },
            {
              id: "assinatura",
              position: "after-summary",
              pdfRender: () => <Text>Assinatura</Text>,
            },
          ],
        }),
        rows: rows(100),
      }),
    );

    expect(pages.length).toBeGreaterThan(3);
    expect(matching(pages[0], "Introducao")).toHaveLength(1);
    expect(matching(pages[0], "Descricao")).toHaveLength(0);
    const tablePages = pages.filter((page) =>
      page.items.some((item) => /^Item-\d/.test(item.text)),
    );
    for (const page of tablePages) {
      expectHeaderAboveRows(page);
    }
    const firstTablePage = tablePages[0];
    expect(matching(firstTablePage, "Instrucoes da tabela")[0].y).toBeLessThan(
      matching(firstTablePage, "Descricao")[0].y,
    );

    const last = pages[pages.length - 1];
    expect(matching(last, "Descricao")).toHaveLength(0);
    const annotation = matching(last, "Anexo final")[0];
    const summary = matching(last, "Itens conferidos")[0];
    const signature = matching(last, "Assinatura")[0];
    expect(annotation.y).toBeLessThan(summary.y);
    expect(summary.y).toBeLessThan(signature.y);
  });

  it("emite uma única linha de cabeçalho quando não há dados", async () => {
    const pages = await readPdf(
      await renderReportToBuffer({
        definition: definition(),
        rows: [],
      }),
    );
    expect(pages).toHaveLength(1);
    expectHeaderAboveRows(pages[0]);
  });
});
