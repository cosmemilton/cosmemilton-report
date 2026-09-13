import { describe, expect, it } from "vitest";
import type { ReportDataset } from "../types.js";
import { datasetToCsv } from "./csv.js";

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
      {
        cells: [
          { raw: "Carla", formatted: "Carla" },
          { raw: 50, formatted: "R$ 50,00" },
        ],
      },
    ],
    summary: [],
    meta: { title: "Teste", generatedAt: new Date(2026, 0, 1) },
  };
}

describe("datasetToCsv", () => {
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
      const protectedField = `'${value}`;
      const escaped = /[\r\n]/.test(value) ? `"${protectedField}"` : protectedField;
      expect(datasetToCsv(dataset)).toBe(`\ufeff${escaped};Total\r\n${escaped};-12,50`);
    },
  );

  it("mantém o escape de delimitador e aspas após neutralizar a fórmula", () => {
    const dataset = makeDataset();
    const value = '=HYPERLINK("https://example.com";"Abrir")';
    dataset.rows = [{ cells: [{ raw: value, formatted: value }] }];
    expect(datasetToCsv(dataset)).toBe(
      '\ufeffNome;Total\r\n"\'=HYPERLINK(""https://example.com"";""Abrir"")"',
    );
  });

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
    expect(datasetToCsv(dataset, { includeBom: false })).toBe("Nome;Total\r\n'-12,50;-12,50");
  });

  it("escapeFormulas: false permite saída literal de texto e cabeçalho", () => {
    const dataset = makeDataset();
    dataset.columns[0].header = "=Nome";
    dataset.rows = [{ cells: [{ raw: "+1", formatted: "+1" }] }];
    expect(datasetToCsv(dataset, { escapeFormulas: false, includeBom: false })).toBe(
      "=Nome;Total\r\n+1",
    );
  });

  it("começa com BOM por default", () => {
    const csv = datasetToCsv(makeDataset());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("usa ';' como delimitador por default", () => {
    const csv = datasetToCsv(makeDataset());
    expect(csv.split("\r\n")[0]).toBe("﻿Nome;Total");
  });

  it("snapshot: CSV de 3 linhas (header + 3 rows), delimitador ';', BOM, CRLF", () => {
    const csv = datasetToCsv(makeDataset());
    expect(csv).toBe("﻿Nome;Total\r\nAna;R$ 100,00\r\nBruno;R$ 200,00\r\nCarla;R$ 50,00");
  });

  it("includeBom: false remove o BOM", () => {
    const csv = datasetToCsv(makeDataset(), { includeBom: false });
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv.startsWith("Nome;Total")).toBe(true);
  });

  it("delimiter configurável (',')", () => {
    const csv = datasetToCsv(makeDataset(), { delimiter: ",", includeBom: false });
    expect(csv.split("\r\n")[0]).toBe("Nome,Total");
  });

  it("escapa campo que contém delimitador, aspas e quebra de linha", () => {
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
          cells: [{ raw: 'Vendedor; "top" \ndestaque', formatted: 'Vendedor; "top" \ndestaque' }],
        },
      ],
      summary: [],
      meta: { title: "Teste", generatedAt: new Date() },
    };

    const csv = datasetToCsv(dataset, { includeBom: false });
    const [, dataLine] = csv.split("\r\n");
    expect(dataLine).toBe('"Vendedor; ""top"" \ndestaque"');
  });

  it("campo sem caractere especial não é envolvido em aspas", () => {
    const csv = datasetToCsv(makeDataset(), { includeBom: false });
    expect(csv).not.toContain('"Ana"');
  });

  it("lineBreak configurável ('\\n')", () => {
    const csv = datasetToCsv(makeDataset(), { includeBom: false, lineBreak: "\n" });
    expect(csv.split("\n")).toHaveLength(4);
    expect(csv.includes("\r")).toBe(false);
  });

  it("não inclui grupos/subtotais/summary — só header + rows", () => {
    const dataset = makeDataset();
    const csv = datasetToCsv(dataset, { includeBom: false });
    expect(csv.split("\r\n")).toHaveLength(4); // header + 3 rows, nada mais
  });
});
