import { describe, expect, it } from "vitest";
import type { ReportDataset } from "../types.js";
import { datasetToTsv } from "./tsv.js";

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
        key: "total",
        header: "Total",
        align: "right",
        format: "currency",
        widthPct: 50,
        noTotal: false,
      },
    ],
    rows: [
      {
        cells: [
          { raw: "Ana", formatted: "Ana" },
          { raw: 100, formatted: "R$ 100,00" },
        ],
      },
      {
        cells: [
          { raw: "Bruno", formatted: "Bruno" },
          { raw: 200, formatted: "R$ 200,00" },
        ],
      },
    ],
    summary: [],
    meta: { title: "Teste", generatedAt: new Date(2026, 0, 1) },
  };
}

describe("datasetToTsv", () => {
  it("sem BOM", () => {
    const tsv = datasetToTsv(makeDataset());
    expect(tsv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("usa tab como separador e '\\n' como quebra de linha", () => {
    const tsv = datasetToTsv(makeDataset());
    expect(tsv).toBe("Nome\tTotal\nAna\tR$ 100,00\nBruno\tR$ 200,00");
  });

  it("não escapa aspas — substitui tab/quebra de linha internos por espaço", () => {
    const dataset: ReportDataset = {
      columns: [
        {
          key: "nome",
          header: "Nome",
          align: "left",
          format: "text",
          widthPct: 100,
          noTotal: false,
        },
      ],
      rows: [
        {
          cells: [
            {
              raw: 'Diz "olá"\tcom\ttab e\nquebra',
              formatted: 'Diz "olá"\tcom\ttab e\nquebra',
            },
          ],
        },
      ],
      summary: [],
      meta: { title: "Teste", generatedAt: new Date() },
    };

    const tsv = datasetToTsv(dataset);
    const [, dataLine] = tsv.split("\n");
    expect(dataLine).toBe('Diz "olá" com tab e quebra');
  });

  it("não inclui grupos/subtotais/summary — só header + rows", () => {
    const tsv = datasetToTsv(makeDataset());
    expect(tsv.split("\n")).toHaveLength(3); // header + 2 rows
  });
});
