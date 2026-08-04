import { describe, expect, it } from "vitest";
import { defineReport } from "./define-report.js";
import type { ReportDefinition } from "./types.js";

type Venda = { data: string; cliente: string; total: number };

describe("defineReport", () => {
  it("preenche sortOrder default pelo índice quando ausente", () => {
    const definition = defineReport<Venda>({
      slug: "vendas",
      name: "Relatório de Vendas",
      columns: [
        { key: "data", header: "Data" },
        { key: "cliente", header: "Cliente" },
        { key: "total", header: "Total", sortOrder: 10 },
      ],
    });

    expect(definition.columns[0].sortOrder).toBe(0);
    expect(definition.columns[1].sortOrder).toBe(1);
    expect(definition.columns[2].sortOrder).toBe(10);
  });

  it("lança em key de coluna duplicada", () => {
    const definition: ReportDefinition<Venda> = {
      slug: "vendas",
      name: "Relatório de Vendas",
      columns: [
        { key: "total", header: "Total" },
        { key: "total", header: "Total (duplicada)" },
      ],
    };

    expect(() => defineReport(definition)).toThrow(/duplicad/i);
  });

  it("retorna a definição tipada preservando os demais campos", () => {
    const definition = defineReport<Venda>({
      slug: "vendas",
      name: "Relatório de Vendas",
      description: "Vendas do período",
      columns: [{ key: "total", header: "Total", format: "currency" }],
      summary: [{ label: "Total geral", sourceColumn: "total", operation: "sum" }],
    });

    expect(definition.slug).toBe("vendas");
    expect(definition.description).toBe("Vendas do período");
    expect(definition.summary).toHaveLength(1);
    expect(definition.columns[0].format).toBe("currency");
  });
});
