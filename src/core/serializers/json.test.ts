import { describe, expect, it } from "vitest";
import type { ReportDataset } from "../types.js";
import { datasetToJson } from "./json.js";

const sampleDate = new Date(2026, 0, 5);

function makeDataset(): ReportDataset {
  return {
    columns: [
      {
        key: "nome",
        header: "Nome",
        align: "left",
        format: "text",
        widthPct: 50,
        noTotal: false,
      },
      {
        key: "data",
        header: "Data",
        align: "left",
        format: "date",
        widthPct: 25,
        noTotal: false,
      },
      {
        key: "total",
        header: "Total",
        align: "right",
        format: "currency",
        widthPct: 25,
        noTotal: false,
      },
    ],
    rows: [
      {
        cells: [
          { raw: "Ana", formatted: "Ana" },
          { raw: sampleDate, formatted: "05/01/2026" },
          { raw: 100, formatted: "R$ 100,00" },
        ],
      },
      {
        cells: [
          { raw: "Bruno", formatted: "Bruno" },
          { raw: null, formatted: "" },
          { raw: 200, formatted: "R$ 200,00" },
        ],
      },
    ],
    total: [null, null, { raw: 300, formatted: "R$ 300,00" }],
    summary: [{ label: "Total geral", value: 300, formatted: "R$ 300,00" }],
    meta: { title: "Teste", generatedAt: new Date(2026, 0, 1), userName: "Milton" },
  };
}

describe("datasetToJson", () => {
  it("shape 'rows' (default): round-trip via JSON.parse devolve os valores raw esperados", () => {
    const json = datasetToJson(makeDataset());
    const parsed = JSON.parse(json);

    expect(parsed).toEqual([
      { nome: "Ana", data: sampleDate.toISOString(), total: 100 },
      { nome: "Bruno", data: null, total: 200 },
    ]);
  });

  it("shape 'rows' é o default (equivalente a passar options.shape: 'rows')", () => {
    const dataset = makeDataset();
    expect(datasetToJson(dataset)).toBe(datasetToJson(dataset, { shape: "rows" }));
  });

  it("shape 'full': inclui meta, columns, rows (raw+formatted), total e summary", () => {
    const json = datasetToJson(makeDataset(), { shape: "full" });
    const parsed = JSON.parse(json);

    expect(parsed.meta.title).toBe("Teste");
    expect(parsed.meta.userName).toBe("Milton");
    expect(parsed.columns).toHaveLength(3);
    expect(parsed.rows[0].cells[0]).toEqual({ raw: "Ana", formatted: "Ana" });
    expect(parsed.rows[0].cells[1].raw).toBe(sampleDate.toISOString());
    expect(parsed.total[0]).toBeNull();
    expect(parsed.total[2]).toEqual({ raw: 300, formatted: "R$ 300,00" });
    expect(parsed.summary).toEqual([{ label: "Total geral", value: 300, formatted: "R$ 300,00" }]);
  });

  it("shape 'full' preserva groups quando presente", () => {
    const dataset = makeDataset();
    dataset.groups = [
      {
        key: "g1",
        label: "Grupo 1",
        rows: dataset.rows,
        subtotal: [null, null, { raw: 300, formatted: "R$ 300,00" }],
      },
    ];

    const parsed = JSON.parse(datasetToJson(dataset, { shape: "full" }));
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].key).toBe("g1");
    expect(parsed.groups[0].subtotal[2].raw).toBe(300);
  });
});
