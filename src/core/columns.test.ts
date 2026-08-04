import { describe, expect, it } from "vitest";
import { normalizeColumnWidths, resolveColumns } from "./columns.js";
import type { ReportColumn, ReportViewColumn } from "./types.js";

type Venda = { data: string; cliente: string; total: number; ativo: boolean };

describe("resolveColumns", () => {
  it("aplica align default: right para formatos numéricos, left para os demais", () => {
    const columns: ReportColumn<Venda>[] = [
      { key: "data", header: "Data", format: "date" },
      { key: "cliente", header: "Cliente" },
      { key: "total", header: "Total", format: "currency" },
    ];

    const resolved = resolveColumns(columns);
    expect(resolved.find((c) => c.key === "data")?.align).toBe("left");
    expect(resolved.find((c) => c.key === "cliente")?.align).toBe("left");
    expect(resolved.find((c) => c.key === "total")?.align).toBe("right");
  });

  it("aplica defaults de visible/hideable/noTotal", () => {
    const columns: ReportColumn<Venda>[] = [{ key: "total", header: "Total" }];
    const [resolved] = resolveColumns(columns);
    expect(resolved.visible).toBe(true);
    expect(resolved.hideable).toBe(true);
    expect(resolved.noTotal).toBe(false);
  });

  it("exportValue default lê a propriedade correspondente da linha", () => {
    const columns: ReportColumn<Venda>[] = [{ key: "total", header: "Total" }];
    const [resolved] = resolveColumns(columns);
    const row: Venda = { data: "2026-08-04", cliente: "Ana", total: 99.9, ativo: true };
    expect(resolved.exportValue(row)).toBe(99.9);
  });

  it("mescla overrides da view por key, ignorando key desconhecida", () => {
    const columns: ReportColumn<Venda>[] = [
      { key: "cliente", header: "Cliente", visible: true },
      { key: "total", header: "Total", format: "currency" },
    ];
    const viewColumns: ReportViewColumn[] = [
      { key: "cliente", visible: false, header: "Cliente (view)" },
      { key: "coluna-inexistente", visible: false },
    ];

    const resolved = resolveColumns(columns, viewColumns);
    const cliente = resolved.find((c) => c.key === "cliente");
    expect(cliente?.visible).toBe(false);
    expect(cliente?.header).toBe("Cliente (view)");
    expect(resolved).toHaveLength(2);
  });

  it("campo não definido na view herda o valor da definição", () => {
    const columns: ReportColumn<Venda>[] = [
      { key: "total", header: "Total", format: "currency", align: "center" },
    ];
    const viewColumns: ReportViewColumn[] = [{ key: "total", visible: false }];

    const [resolved] = resolveColumns(columns, viewColumns);
    expect(resolved.align).toBe("center");
    expect(resolved.format).toBe("currency");
    expect(resolved.visible).toBe(false);
  });
});

describe("normalizeColumnWidths", () => {
  it("re-normaliza 50/30/20 ocultando a de 20% para 62.5/37.5, somando 100", () => {
    const columns: ReportColumn<Venda>[] = [
      { key: "data", header: "Data", width: "50%" },
      { key: "cliente", header: "Cliente", width: "30%" },
      { key: "total", header: "Total", width: "20%", visible: false },
    ];

    const resolved = resolveColumns(columns);
    const normalized = normalizeColumnWidths(resolved);

    expect(normalized).toHaveLength(2);
    const data = normalized.find((c) => c.key === "data");
    const cliente = normalized.find((c) => c.key === "cliente");
    expect(data?.widthPct).toBeCloseTo(62.5, 2);
    expect(cliente?.widthPct).toBeCloseTo(37.5, 2);

    const total = normalized.reduce((sum, c) => sum + c.widthPct, 0);
    expect(total).toBeCloseTo(100, 2);
  });

  it("distribui largura para colunas sem width definida", () => {
    const columns: ReportColumn<Venda>[] = [
      { key: "data", header: "Data", width: "50%" },
      { key: "cliente", header: "Cliente" },
      { key: "total", header: "Total" },
    ];

    const normalized = normalizeColumnWidths(resolveColumns(columns));
    const total = normalized.reduce((sum, c) => sum + c.widthPct, 0);
    expect(total).toBeCloseTo(100, 2);
    expect(normalized.find((c) => c.key === "cliente")?.widthPct).toBeCloseTo(25, 2);
    expect(normalized.find((c) => c.key === "total")?.widthPct).toBeCloseTo(25, 2);
  });

  it("ordena por sortOrder e filtra apenas colunas visíveis", () => {
    const columns: ReportColumn<Venda>[] = [
      { key: "total", header: "Total", sortOrder: 1 },
      { key: "cliente", header: "Cliente", sortOrder: 0 },
      { key: "data", header: "Data", sortOrder: 2, visible: false },
    ];

    const normalized = normalizeColumnWidths(resolveColumns(columns));
    expect(normalized.map((c) => c.key)).toEqual(["cliente", "total"]);
  });
});
