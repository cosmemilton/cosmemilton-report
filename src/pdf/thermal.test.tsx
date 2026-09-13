// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readPdf } from "../../tests/pdf.js";
import { parseReportGlobalConfig } from "../core/parse.js";
import type { ReportDefinition } from "../core/types.js";
import { mmToPt } from "./map-columns.js";
import { renderReportToBuffer } from "./render.js";

type Item = { item: string; total: number };
const definition: ReportDefinition<Item> = {
  slug: "cupom",
  name: "Comprovante de venda",
  columns: [
    { key: "item", header: "Produto", width: "65%" },
    { key: "total", header: "Valor", width: "35%", format: "currency" },
  ],
  style: { headerFontSize: 8, density: "compact" },
  summary: [{ label: "Total pago", sourceColumn: "total", operation: "sum", format: "currency" }],
};

function makeRows(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({ item: `Item ${index + 1}`, total: 10 }));
}

describe("PDF térmico", { timeout: 15_000 }, () => {
  it.each([58, 80] as const)(
    "gera cupom contínuo de %s mm com rodapé após os dados",
    async (width) => {
      const globalConfig = parseReportGlobalConfig({
        paperSize: `${width}mm`,
        orientation: "landscape",
        companyName: "Mercado da Esquina",
        footerText: "Obrigado pela compra!",
      });
      const render = async (count: number) =>
        readPdf(
          await renderReportToBuffer({
            definition,
            rows: makeRows(count),
            globalConfig,
          }),
        );
      const short = await render(2);
      const long = await render(80);
      expect(short).toHaveLength(1);
      expect(long).toHaveLength(1);
      expect(long[0].height).toBeGreaterThan(short[0].height);

      for (const [pages, count] of [
        [short, 2],
        [long, 80],
      ] as const) {
        const page = pages[0];
        expect(page.width).toBeCloseTo(mmToPt(width), 2);
        const footer = page.items.find((item) => item.text === "Obrigado pela compra!");
        const lastRow = page.items.find((item) => item.text === `Item ${count}`);
        const summary = page.items.find((item) => item.text.includes("Total pago"));
        expect(footer).toBeDefined();
        expect(lastRow).toBeDefined();
        expect(summary).toBeDefined();
        expect(footer!.y).toBeGreaterThan(summary!.y);
        expect(summary!.y).toBeGreaterThan(lastRow!.y);
        expect(footer!.y).toBeLessThan(page.height - mmToPt(3));
        for (const item of page.items.filter((item) => item.text.trim())) {
          expect(item.x).toBeGreaterThanOrEqual(mmToPt(3) - 0.1);
          expect(item.x + item.width).toBeLessThanOrEqual(page.width - mmToPt(3) + 0.1);
        }
        for (let index = 1; index <= count; index += 1) {
          expect(page.items.filter((item) => item.text === `Item ${index}`)).toHaveLength(1);
        }
      }
    },
  );
});
