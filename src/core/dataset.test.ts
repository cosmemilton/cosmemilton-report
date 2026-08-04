import { describe, expect, it } from "vitest";
import { buildReportDataset } from "./dataset.js";
import { resolveReport } from "./resolve.js";
import type { ReportColumn, ReportDefinition } from "./types.js";

type Venda = { vendedor: string; produto: string; quantidade: number; preco: number };

const columns: ReportColumn<Venda>[] = [
  { key: "vendedor", header: "Vendedor" },
  { key: "produto", header: "Produto" },
  { key: "quantidade", header: "Qtd", format: "integer" },
  { key: "preco", header: "Preço", format: "currency" },
  {
    key: "totalLinha",
    header: "Total",
    format: "currency",
    exportValue: (row) => row.quantidade * row.preco,
  },
  { key: "margem", header: "Margem", format: "percent", noTotal: true, exportValue: () => 0.2 },
];

const rows: Venda[] = [
  { vendedor: "Ana", produto: "A", quantidade: 2, preco: 10 },
  { vendedor: "Bruno", produto: "C", quantidade: 3, preco: 5 },
  { vendedor: "Ana", produto: "B", quantidade: 1, preco: 30 },
];

function definition(overrides?: Partial<ReportDefinition<Venda>>): ReportDefinition<Venda> {
  return { slug: "vendas", name: "Relatório de Vendas", columns, ...overrides };
}

describe("buildReportDataset", () => {
  it("exportValue custom é respeitado (coluna derivada calculada)", () => {
    const resolved = resolveReport({ definition: definition() });
    const dataset = buildReportDataset(resolved, rows);

    const totalLinhaIndex = dataset.columns.findIndex((c) => c.key === "totalLinha");
    expect(dataset.rows[0].cells[totalLinhaIndex].raw).toBe(20); // Ana: 2 * 10
    expect(dataset.rows[1].cells[totalLinhaIndex].raw).toBe(15); // Bruno: 3 * 5
    expect(dataset.rows[2].cells[totalLinhaIndex].raw).toBe(30); // Ana: 1 * 30
  });

  it("sem group: rows na ordem original, groups ausente", () => {
    const resolved = resolveReport({ definition: definition() });
    const dataset = buildReportDataset(resolved, rows);

    expect(dataset.groups).toBeUndefined();
    expect(dataset.rows).toHaveLength(3);
    expect(dataset.rows[0].cells[0].raw).toBe("Ana");
    expect(dataset.rows[1].cells[0].raw).toBe("Bruno");
    expect(dataset.rows[2].cells[0].raw).toBe("Ana");
  });

  it("com group: monta grupos na ordem de primeira aparição e reordena `rows` por grupo", () => {
    const resolved = resolveReport({ definition: definition({ group: { by: "vendedor" } }) });
    const dataset = buildReportDataset(resolved, rows);

    expect(dataset.groups).toHaveLength(2);
    expect(dataset.groups?.map((g) => g.key)).toEqual(["Ana", "Bruno"]);
    expect(dataset.groups?.[0].rows).toHaveLength(2);
    expect(dataset.groups?.[1].rows).toHaveLength(1);

    // rows no dataset ficam na ordem dos grupos (Ana, Ana, Bruno), não na ordem original (Ana,
    // Bruno, Ana).
    const vendedorIndex = dataset.columns.findIndex((c) => c.key === "vendedor");
    const produtoIndex = dataset.columns.findIndex((c) => c.key === "produto");
    expect(dataset.rows.map((r) => r.cells[vendedorIndex].raw)).toEqual(["Ana", "Ana", "Bruno"]);
    expect(dataset.rows.map((r) => r.cells[produtoIndex].raw)).toEqual(["A", "B", "C"]);
  });

  it("subtotal aparece só nas colunas numéricas sem noTotal; demais células são null", () => {
    const resolved = resolveReport({ definition: definition({ group: { by: "vendedor" } }) });
    const dataset = buildReportDataset(resolved, rows);

    const idx = (key: string) => dataset.columns.findIndex((c) => c.key === key);
    const [anaGroup, brunoGroup] = dataset.groups ?? [];

    // Ana: quantidade 2+1=3, preco 10+30=40, totalLinha 20+30=50.
    expect(anaGroup.subtotal?.[idx("quantidade")]).toEqual({
      raw: 3,
      formatted: expect.any(String),
    });
    expect(anaGroup.subtotal?.[idx("preco")]?.raw).toBe(40);
    expect(anaGroup.subtotal?.[idx("totalLinha")]?.raw).toBe(50);
    // não numéricas (vendedor/produto) e noTotal (margem) ficam null.
    expect(anaGroup.subtotal?.[idx("vendedor")]).toBeNull();
    expect(anaGroup.subtotal?.[idx("produto")]).toBeNull();
    expect(anaGroup.subtotal?.[idx("margem")]).toBeNull();

    // Bruno: quantidade 3, preco 5, totalLinha 15.
    expect(brunoGroup.subtotal?.[idx("quantidade")]?.raw).toBe(3);
    expect(brunoGroup.subtotal?.[idx("preco")]?.raw).toBe(5);
    expect(brunoGroup.subtotal?.[idx("totalLinha")]?.raw).toBe(15);
  });

  it("showSubtotal: false suprime o subtotal do grupo", () => {
    const resolved = resolveReport({
      definition: definition({ group: { by: "vendedor", showSubtotal: false } }),
    });
    const dataset = buildReportDataset(resolved, rows);
    expect(dataset.groups?.every((g) => g.subtotal === undefined)).toBe(true);
  });

  it("total geral soma todas as linhas (não só um grupo) nas colunas numéricas elegíveis", () => {
    const resolved = resolveReport({ definition: definition({ group: { by: "vendedor" } }) });
    const dataset = buildReportDataset(resolved, rows);
    const idx = (key: string) => dataset.columns.findIndex((c) => c.key === key);

    // quantidade: 2+3+1=6, preco: 10+5+30=45, totalLinha: 20+15+30=65.
    expect(dataset.total?.[idx("quantidade")]?.raw).toBe(6);
    expect(dataset.total?.[idx("preco")]?.raw).toBe(45);
    expect(dataset.total?.[idx("totalLinha")]?.raw).toBe(65);
    expect(dataset.total?.[idx("vendedor")]).toBeNull();
    expect(dataset.total?.[idx("margem")]).toBeNull();
  });

  it("total ausente quando não há nenhuma coluna numérica sem noTotal", () => {
    const textOnlyColumns: ReportColumn<Venda>[] = [
      { key: "vendedor", header: "Vendedor" },
      { key: "produto", header: "Produto" },
    ];
    const resolved = resolveReport({
      definition: { slug: "vendas", name: "Vendas", columns: textOnlyColumns },
    });
    const dataset = buildReportDataset(resolved, rows);
    expect(dataset.total).toBeUndefined();
  });

  it("meta.generatedAt tem default new Date() quando não informado", () => {
    const resolved = resolveReport({ definition: definition() });
    const before = Date.now();
    const dataset = buildReportDataset(resolved, rows);
    const after = Date.now();

    expect(dataset.meta.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(dataset.meta.generatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("meta usa userName/generatedAt informados", () => {
    const resolved = resolveReport({ definition: definition() });
    const generatedAt = new Date(2026, 0, 1);
    const dataset = buildReportDataset(resolved, rows, { userName: "Milton", generatedAt });
    expect(dataset.meta.userName).toBe("Milton");
    expect(dataset.meta.generatedAt).toBe(generatedAt);
  });

  it("usa só resolved.visibleColumns (coluna oculta não aparece no dataset)", () => {
    const withHidden = definition({
      columns: columns.map((c) => (c.key === "margem" ? { ...c, visible: false } : c)),
    });
    const resolved = resolveReport({ definition: withHidden });
    const dataset = buildReportDataset(resolved, rows);
    expect(dataset.columns.some((c) => c.key === "margem")).toBe(false);
  });
});
