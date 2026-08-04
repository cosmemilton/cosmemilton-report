import { describe, expect, it } from "vitest";
import { resolveColumns } from "./columns.js";
import { computeSummary } from "./summary.js";
import type {
  ReportCellValue,
  ReportColumn,
  ReportSummaryItem,
  ResolvedReportColumn,
} from "./types.js";

/** Normaliza NBSP/narrow-NBSP (usados pelo Intl para separar moeda/número) em espaço comum. */
function normalize(value: string): string {
  return value.replace(/[\u00A0\u202F]/g, " ");
}

type Venda = { cliente: string; total: number };

const vendaColumns: ReportColumn<Venda>[] = [
  { key: "cliente", header: "Cliente" },
  { key: "total", header: "Total", format: "currency" },
];
const resolvedVendaColumns = resolveColumns(vendaColumns);

const vendas: Venda[] = [
  { cliente: "Ana", total: 100 },
  { cliente: "Bruno", total: 200 },
  { cliente: "Carla", total: 50 },
  { cliente: "Davi", total: 150 },
];

describe("computeSummary", () => {
  it("sum/avg/min/max corretos num dataset de 4 linhas", () => {
    const items: ReportSummaryItem[] = [
      { label: "Soma", sourceColumn: "total", operation: "sum" },
      { label: "Média", sourceColumn: "total", operation: "avg" },
      { label: "Mínimo", sourceColumn: "total", operation: "min" },
      { label: "Máximo", sourceColumn: "total", operation: "max" },
    ];

    const [sum, avg, min, max] = computeSummary(vendas, items, resolvedVendaColumns);
    expect(sum.value).toBe(500);
    expect(avg.value).toBe(125);
    expect(min.value).toBe(50);
    expect(max.value).toBe(200);
  });

  it("count com sourceColumn de coluna conta linhas com valor não-nulo", () => {
    const items: ReportSummaryItem[] = [
      { label: "Contagem", sourceColumn: "total", operation: "count" },
    ];
    const [result] = computeSummary(vendas, items, resolvedVendaColumns);
    expect(result.value).toBe(4);
  });

  it("sourceColumn '*' conta todas as linhas, independente da operação", () => {
    const items: ReportSummaryItem[] = [
      { label: "Total de linhas", sourceColumn: "*", operation: "count" },
    ];
    const [result] = computeSummary(vendas, items, resolvedVendaColumns);
    expect(result.value).toBe(4);
  });

  it("formatação currency aplicada via format da coluna correspondente (fallback)", () => {
    const items: ReportSummaryItem[] = [
      { label: "Total geral", sourceColumn: "total", operation: "sum" },
    ];
    const [result] = computeSummary(vendas, items, resolvedVendaColumns);
    expect(normalize(result.formatted)).toBe("R$ 500,00");
  });

  it("format do item tem prioridade sobre o format da coluna", () => {
    const items: ReportSummaryItem[] = [
      { label: "Total geral", sourceColumn: "total", operation: "sum", format: "integer" },
    ];
    const [result] = computeSummary(vendas, items, resolvedVendaColumns);
    expect(normalize(result.formatted)).toBe("500");
  });

  it("sem coluna correspondente e sem format do item, cai para 'number' (2 casas por default)", () => {
    const items: ReportSummaryItem[] = [{ label: "Linhas", sourceColumn: "*", operation: "count" }];
    const [result] = computeSummary(vendas, items, resolvedVendaColumns);
    expect(normalize(result.formatted)).toBe("4,00");
  });

  it("ignora valores não numéricos em sum/avg/min/max, mas count conta não-nulos", () => {
    type MixedRow = { valor: unknown };
    const mixedRows: MixedRow[] = [
      { valor: 10 },
      { valor: "20" }, // string numérica é válida
      { valor: "abc" }, // não numérico: ignorado por sum/avg/min/max
      { valor: null }, // nulo: ignorado por todos, inclusive count
    ];
    const mixedColumn: ResolvedReportColumn<MixedRow> = {
      key: "valor",
      header: "Valor",
      widthPct: 100,
      align: "right",
      format: "number",
      visible: true,
      hideable: true,
      sortOrder: 0,
      noTotal: false,
      exportValue: (row) => row.valor as ReportCellValue,
    };

    const items: ReportSummaryItem[] = [
      { label: "Soma", sourceColumn: "valor", operation: "sum" },
      { label: "Média", sourceColumn: "valor", operation: "avg" },
      { label: "Contagem", sourceColumn: "valor", operation: "count" },
    ];

    const [sum, avg, count] = computeSummary(mixedRows, items, [mixedColumn]);
    expect(sum.value).toBe(30);
    expect(avg.value).toBe(15);
    expect(count.value).toBe(3);
  });

  it("sum/avg/min/max sem nenhum valor numérico resultam em 0 (sem lançar)", () => {
    type MixedRow = { valor: unknown };
    const mixedRows: MixedRow[] = [{ valor: "abc" }, { valor: null }];
    const mixedColumn: ResolvedReportColumn<MixedRow> = {
      key: "valor",
      header: "Valor",
      widthPct: 100,
      align: "right",
      format: "number",
      visible: true,
      hideable: true,
      sortOrder: 0,
      noTotal: false,
      exportValue: (row) => row.valor as ReportCellValue,
    };

    const items: ReportSummaryItem[] = [
      { label: "Soma", sourceColumn: "valor", operation: "sum" },
      { label: "Média", sourceColumn: "valor", operation: "avg" },
      { label: "Mínimo", sourceColumn: "valor", operation: "min" },
      { label: "Máximo", sourceColumn: "valor", operation: "max" },
    ];

    const [sum, avg, min, max] = computeSummary(mixedRows, items, [mixedColumn]);
    expect(sum.value).toBe(0);
    expect(avg.value).toBe(0);
    expect(min.value).toBe(0);
    expect(max.value).toBe(0);
  });
});
