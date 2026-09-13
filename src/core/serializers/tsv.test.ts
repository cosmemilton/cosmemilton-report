import { describe, expect, it } from "vitest";
import { exportReportToTsv } from "../export.js";
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
  it.each(["=1+1", "+SUM(1,1)", "-2+3", "@SUM(1,1)", "  =1+1", "\t+1", "\r\n-2", "\u00a0@x"])(
    "neutraliza fórmula em texto e cabeçalho: %j",
    (value) => {
      const dataset = makeDataset();
      dataset.columns[0].header = value;
      dataset.rows = [
        {
          cells: [
            { raw: value, formatted: value },
            { raw: -12.5, formatted: "-12,50" },
          ],
        },
      ];
      const protectedField = `'${value.replace(/[\t\r\n]+/g, " ")}`;
      expect(datasetToTsv(dataset)).toBe(`${protectedField}\tTotal\n${protectedField}\t-12,50`);
    },
  );

  it("distingue número negativo de texto iniciado por menos", () => {
    const dataset = makeDataset();
    dataset.rows = [
      {
        cells: [
          { raw: "-12,50", formatted: "-12,50" },
          { raw: -12.5, formatted: "-12,50" },
        ],
      },
    ];
    expect(datasetToTsv(dataset)).toBe("Nome\tTotal\n'-12,50\t-12,50");
  });

  it("escapeFormulas: false permite saída literal, mantendo a limpeza de tabs/quebras", () => {
    const dataset = makeDataset();
    dataset.columns[0].header = "=Nome";
    dataset.rows = [{ cells: [{ raw: "\t+1", formatted: "\t+1" }] }];
    expect(datasetToTsv(dataset, { escapeFormulas: false })).toBe("=Nome\tTotal\n +1");
  });

  it("o atalho exportReportToTsv também permite desativar a proteção explicitamente", () => {
    const input = {
      definition: { slug: "nomes", name: "Nomes", columns: [{ key: "nome", header: "Nome" }] },
      rows: [{ nome: "=1+1" }],
    };
    expect(exportReportToTsv(input)).toBe("Nome\n'=1+1");
    expect(exportReportToTsv(input, { escapeFormulas: false })).toBe("Nome\n=1+1");
  });

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
