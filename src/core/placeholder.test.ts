import { describe, expect, it } from "vitest";
import { generatePlaceholderRows } from "./placeholder.js";

describe("generatePlaceholderRows", () => {
  it("é determinístico: duas chamadas com os mesmos argumentos retornam o mesmo resultado", () => {
    const columns = [
      { key: "nome", format: "text" as const },
      { key: "valor", format: "currency" as const },
      { key: "data", format: "date" as const },
    ];

    const first = generatePlaceholderRows(columns, 5);
    const second = generatePlaceholderRows(columns, 5);
    expect(first).toEqual(second);
  });

  it("gera 20 linhas por default", () => {
    const rows = generatePlaceholderRows([{ key: "nome", format: "text" as const }]);
    expect(rows).toHaveLength(20);
  });

  it("respeita count customizado", () => {
    const rows = generatePlaceholderRows([{ key: "nome" }], 3);
    expect(rows).toHaveLength(3);
  });

  it("number/currency: (i+1) * 123.45", () => {
    const rows = generatePlaceholderRows(
      [
        { key: "n", format: "number" as const },
        { key: "c", format: "currency" as const },
      ],
      3,
    );
    expect(rows.map((r) => r.n)).toEqual([123.45, 246.9, 370.35]);
    expect(rows.map((r) => r.c)).toEqual([123.45, 246.9, 370.35]);
  });

  it("integer: i+1", () => {
    const rows = generatePlaceholderRows([{ key: "n", format: "integer" as const }], 3);
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3]);
  });

  it("percent: (i % 10) / 10", () => {
    const rows = generatePlaceholderRows([{ key: "p", format: "percent" as const }], 12);
    expect(rows.map((r) => r.p)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0, 0.1]);
  });

  it("date/datetime: new Date(2026, 0, 1 + i)", () => {
    const rows = generatePlaceholderRows(
      [
        { key: "d", format: "date" as const },
        { key: "dt", format: "datetime" as const },
      ],
      3,
    );
    expect(rows.map((r) => r.d)).toEqual([
      new Date(2026, 0, 1),
      new Date(2026, 0, 2),
      new Date(2026, 0, 3),
    ]);
    expect(rows.map((r) => r.dt)).toEqual([
      new Date(2026, 0, 1),
      new Date(2026, 0, 2),
      new Date(2026, 0, 3),
    ]);
  });

  it("text (ou format ausente): 'Exemplo ' + (i+1)", () => {
    const rows = generatePlaceholderRows([{ key: "a", format: "text" as const }, { key: "b" }], 3);
    expect(rows.map((r) => r.a)).toEqual(["Exemplo 1", "Exemplo 2", "Exemplo 3"]);
    expect(rows.map((r) => r.b)).toEqual(["Exemplo 1", "Exemplo 2", "Exemplo 3"]);
  });

  it("cada coluna recebe seu próprio valor, indexado por key", () => {
    const rows = generatePlaceholderRows(
      [
        { key: "nome", format: "text" as const },
        { key: "total", format: "currency" as const },
      ],
      2,
    );
    expect(rows[0]).toEqual({ nome: "Exemplo 1", total: 123.45 });
    expect(rows[1]).toEqual({ nome: "Exemplo 2", total: 246.9 });
  });
});
