// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readPdf } from "../../tests/pdf.js";
import type { ReportDefinition, ReportPaperSize } from "../core/types.js";
import { mmToPt } from "./map-columns.js";
import { renderReportToBuffer } from "./render.js";

type Sale = { product: string; amount: number };

const definition: ReportDefinition<Sale> = {
  slug: "sumario-cupom",
  name: "Comprovante de venda",
  columns: [{ key: "product", header: "Produto" }],
  summary: [
    {
      label: "Valor total das mercadorias",
      sourceColumn: "amount",
      operation: "sum",
      format: "currency",
    },
    { label: "Itens", sourceColumn: "*", operation: "count", format: "integer" },
  ],
};

describe("sumário dentro das margens do PDF", { timeout: 15_000 }, () => {
  it.each(["58mm", "80mm", "A4"] satisfies ReportPaperSize[])(
    "preserva rótulo longo e moeda completa no papel %s",
    async (paperSize) => {
      const pages = await readPdf(
        await renderReportToBuffer({
          definition,
          rows: [{ product: "Produto vendido", amount: 1234567.89 }],
          globalConfig: { paperSize, footerText: "Obrigado!" },
        }),
      );

      expect(pages).toHaveLength(1);
      const page = pages[0];
      const margin = mmToPt(paperSize === "A4" ? 10 : 3);
      const allText = page.items.map((item) => item.text).join("");
      expect(allText.replace(/[\s-]/g, "")).toContain("Valortotaldasmercadorias:");
      const amount = page.items.find((item) => item.text === "R$ 1.234.567,89");
      expect(amount).toBeDefined();
      expect(amount!.x + amount!.width).toBeCloseTo(page.width - margin, 1);

      const product = page.items.find((item) => item.text === "Produto vendido");
      const nextSummary = page.items.find((item) => item.text.startsWith("Itens"));
      const footer = page.items.find((item) => item.text === "Obrigado!");
      expect(amount!.y - amount!.height).toBeGreaterThan(product!.y);
      expect(nextSummary!.y - nextSummary!.height).toBeGreaterThan(amount!.y);
      expect(footer!.y - footer!.height).toBeGreaterThan(nextSummary!.y);

      for (const item of page.items) {
        expect(item.x).toBeGreaterThanOrEqual(margin - 0.1);
        expect(item.x + item.width).toBeLessThanOrEqual(page.width - margin + 0.1);
      }
    },
  );
});
