// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buildReportDataset } from "../core/dataset.js";
import { resolveReport } from "../core/resolve.js";
import type { ReportDefinition } from "../core/types.js";
import { resolveMaxRowsPerBlock } from "./options.js";
import { buildReportPdfTableBlocks } from "./table-blocks.js";

type Row = { id: string; group: string; amount: number };

function prepare(rows: Row[], extras: Partial<ReportDefinition<Row>> = {}) {
  const resolved = resolveReport({
    definition: {
      slug: "blocks",
      name: "Blocos",
      columns: [
        { key: "id", header: "Item" },
        { key: "amount", header: "Valor", format: "number" },
      ],
      ...extras,
    },
  });
  return { resolved, dataset: buildReportDataset(resolved, rows) };
}

describe("blocos de paginação PDF", () => {
  it("limita dados por bloco preservando referências, índice global e um único total", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `Item-${index}`,
      group: "A",
      amount: index + 1,
    }));
    const { resolved, dataset } = prepare(rows);
    const blocks = buildReportPdfTableBlocks(resolved, rows, dataset, 2);
    expect(
      blocks.map((block) => block.entries.filter((entry) => entry.kind === "row").length),
    ).toEqual([2, 2, 1]);
    const entries = blocks.flatMap((block) => block.entries);
    const dataEntries = entries.filter((entry) => entry.kind === "row");
    expect(dataEntries.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4]);
    dataEntries.forEach((entry, index) => {
      expect(entry.row).toBe(rows[index]);
      expect(entry.cells).toBe(dataset.rows[index].cells);
    });
    const aggregates = entries.filter((entry) => entry.kind === "aggregate");
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0].cells).toBe(dataset.total);
    expect(blocks.at(-1)?.entries.at(-1)).toBe(aggregates[0]);
  });

  it("divide dentro do grupo sem repetir rótulos, recalcular subtotais ou reiniciar a zebra", () => {
    const rows: Row[] = [
      { id: "A1", group: "A", amount: 1 },
      { id: "B1", group: "B", amount: 10 },
      { id: "A2", group: "A", amount: 2 },
      { id: "B2", group: "B", amount: 20 },
      { id: "A3", group: "A", amount: 3 },
      { id: "A4", group: "A", amount: 4 },
      { id: "B3", group: "B", amount: 30 },
    ];
    const label = vi.fn((key: string) => `Grupo ${key}`);
    const { resolved, dataset } = prepare(rows, { group: { by: "group", label } });
    expect(label).toHaveBeenCalledTimes(2);
    const blocks = buildReportPdfTableBlocks(resolved, rows, dataset, 3);
    expect(label).toHaveBeenCalledTimes(2);
    expect(
      blocks.map((block) =>
        block.entries.map((entry) => (entry.kind === "row" ? entry.row.id : entry.label)),
      ),
    ).toEqual([
      ["Grupo A", "A1", "A2", "A3"],
      ["A4", "Subtotal", "Grupo B", "B1", "B2"],
      ["B3", "Subtotal", "Total"],
    ]);
    const entries = blocks.flatMap((block) => block.entries);
    const dataEntries = entries.filter((entry) => entry.kind === "row");
    expect(dataEntries.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dataEntries[0].row).toBe(rows[0]);
    expect(dataEntries[4].row).toBe(rows[1]);
    expect(dataEntries[4].cells).toBe(dataset.groups?.[1].rows[0].cells);
    const subtotals = entries
      .filter((entry) => entry.kind === "aggregate")
      .filter((entry) => entry.label === "Subtotal");
    expect(subtotals[0].cells).toBe(dataset.groups?.[0].subtotal);
    expect(subtotals[1].cells).toBe(dataset.groups?.[1].subtotal);
  });

  it("mantém rótulo de grupo com sua primeira linha quando a fronteira coincide com o bloco", () => {
    const rows: Row[] = [
      { id: "A", group: "A", amount: 1 },
      { id: "B", group: "B", amount: 2 },
    ];
    const { resolved, dataset } = prepare(rows, { group: { by: "group", showSubtotal: false } });
    const blocks = buildReportPdfTableBlocks(resolved, rows, dataset, 1);
    expect(blocks).toHaveLength(2);
    expect(blocks[1].entries[0]).toMatchObject({ kind: "group", label: "B" });
    expect(blocks[1].entries[1]).toMatchObject({ kind: "row", row: rows[1] });
    expect(
      blocks.flatMap((block) => block.entries).filter((entry) => entry.kind === "aggregate"),
    ).toHaveLength(1);
  });

  it("não cria um bloco vazio após atingir exatamente o limite", () => {
    const rows: Row[] = [{ id: "A", group: "A", amount: 1 }];
    const { resolved, dataset } = prepare(rows);
    const blocks = buildReportPdfTableBlocks(resolved, rows, dataset, 1);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].entries.map((entry) => entry.kind)).toEqual(["row", "aggregate"]);
  });

  it("preserva um bloco para dados vazios e para paginação contínua", () => {
    const empty = prepare([]);
    expect(buildReportPdfTableBlocks(empty.resolved, [], empty.dataset, 100)).toHaveLength(1);
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: String(index),
      group: "A",
      amount: index,
    }));
    const { resolved, dataset } = prepare(rows);
    expect(buildReportPdfTableBlocks(resolved, rows, dataset, false)).toHaveLength(1);
    expect(
      buildReportPdfTableBlocks(resolved, rows, dataset, resolveMaxRowsPerBlock()),
    ).toHaveLength(2);
  });
});

describe("opções de blocos PDF", () => {
  it("usa 100 por padrão e aceita false ou inteiro positivo", () => {
    expect(resolveMaxRowsPerBlock()).toBe(100);
    expect(resolveMaxRowsPerBlock({})).toBe(100);
    expect(resolveMaxRowsPerBlock({ maxRowsPerBlock: false })).toBe(false);
    expect(resolveMaxRowsPerBlock({ maxRowsPerBlock: 1 })).toBe(1);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejeita limite inválido %s",
    (maxRowsPerBlock) => {
      expect(() => resolveMaxRowsPerBlock({ maxRowsPerBlock })).toThrow(RangeError);
    },
  );
});
