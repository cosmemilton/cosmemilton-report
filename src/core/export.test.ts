import { describe, expect, it } from "vitest";
import { exportReportToCsv, exportReportToJson, exportReportToTsv } from "./export.js";
import type { ReportDefinition, ReportRenderInput } from "./types.js";

/** Normaliza NBSP/narrow-NBSP (usados pelo Intl para separar moeda/número) em espaço comum. */
function normalize(value: string): string {
  return value.replace(/[\u00A0\u202F]/g, " ");
}

type Venda = { data: string; cliente: string; total: number };

const definition: ReportDefinition<Venda> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date" },
    { key: "cliente", header: "Cliente" },
    { key: "total", header: "Total", format: "currency" },
  ],
  summary: [{ label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" }],
};

const rows: Venda[] = [
  { data: "2026-01-05", cliente: "Ana", total: 100 },
  { data: "2026-01-06", cliente: "Bruno", total: 200 },
];

const input: ReportRenderInput<Venda> = { definition, rows };

describe("exportReportToCsv", () => {
  it("resolve o input e serializa em CSV pt-BR (';' + BOM por default)", () => {
    const csv = exportReportToCsv(input);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const normalized = normalize(csv);
    expect(normalized).toContain("Data;Cliente;Total");
    expect(normalized).toContain("05/01/2026;Ana;R$ 100,00");
    expect(normalized).toContain("06/01/2026;Bruno;R$ 200,00");
  });

  it("aceita CsvOptions (delimiter/includeBom)", () => {
    const csv = exportReportToCsv(input, { delimiter: ",", includeBom: false });
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv.split("\r\n")[0]).toBe("Data,Cliente,Total");
  });
});

describe("exportReportToTsv", () => {
  it("resolve o input e serializa em TSV sem BOM", () => {
    const tsv = exportReportToTsv(input);
    expect(tsv.charCodeAt(0)).not.toBe(0xfeff);
    expect(tsv.split("\n")[0]).toBe("Data\tCliente\tTotal");
  });
});

describe("exportReportToJson", () => {
  it("shape 'rows': round-trip com os valores raw (data continua string, sem exportValue custom)", () => {
    const json = exportReportToJson(input);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([
      { data: "2026-01-05", cliente: "Ana", total: 100 },
      { data: "2026-01-06", cliente: "Bruno", total: 200 },
    ]);
  });

  it("shape 'full': inclui o summary calculado pela pipeline (resolveReport → buildReportDataset)", () => {
    const json = exportReportToJson(input, { shape: "full" });
    const parsed = JSON.parse(json);
    expect(parsed.summary).toHaveLength(1);
    expect(parsed.summary[0].value).toBe(300);
  });

  it("overrides chegam ao dataset via resolveReport (title no meta)", () => {
    const withOverride: ReportRenderInput<Venda> = {
      ...input,
      overrides: { title: "Vendas de Janeiro" },
    };
    const parsed = JSON.parse(exportReportToJson(withOverride, { shape: "full" }));
    expect(parsed.meta.title).toBe("Vendas de Janeiro");
  });
});
