import { describe, expect, it } from "vitest";
import { groupRows } from "./groups.js";
import type { ReportGroupConfig } from "./types.js";

type Venda = { vendedor: string; total: number };

const vendas: Venda[] = [
  { vendedor: "Ana", total: 100 },
  { vendedor: "Bruno", total: 50 },
  { vendedor: "Ana", total: 200 },
  { vendedor: "Carla", total: 30 },
  { vendedor: "Bruno", total: 70 },
];

describe("groupRows", () => {
  it("agrupa preservando a ordem de primeira aparição", () => {
    const group: ReportGroupConfig<Venda> = { by: "vendedor" };
    const groups = groupRows(vendas, group);
    expect(groups.map((g) => g.key)).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("cada grupo contém as linhas correspondentes, na ordem original", () => {
    const group: ReportGroupConfig<Venda> = { by: "vendedor" };
    const [ana, bruno, carla] = groupRows(vendas, group);
    expect(ana.rows).toEqual([
      { vendedor: "Ana", total: 100 },
      { vendedor: "Ana", total: 200 },
    ]);
    expect(bruno.rows).toEqual([
      { vendedor: "Bruno", total: 50 },
      { vendedor: "Bruno", total: 70 },
    ]);
    expect(carla.rows).toEqual([{ vendedor: "Carla", total: 30 }]);
  });

  it("label default é a própria groupKey", () => {
    const group: ReportGroupConfig<Venda> = { by: "vendedor" };
    const groups = groupRows(vendas, group);
    expect(groups.map((g) => g.label)).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("usa group.label(key, rows) quando fornecido", () => {
    const group: ReportGroupConfig<Venda> = {
      by: "vendedor",
      label: (key, rows) => `${key} (${rows.length})`,
    };
    const groups = groupRows(vendas, group);
    expect(groups.map((g) => g.label)).toEqual(["Ana (2)", "Bruno (2)", "Carla (1)"]);
  });

  it("aceita 'by' como função", () => {
    const group: ReportGroupConfig<Venda> = {
      by: (row) => (row.total >= 100 ? "grande" : "pequeno"),
    };
    const groups = groupRows(vendas, group);
    expect(groups.map((g) => g.key)).toEqual(["grande", "pequeno"]);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].rows).toHaveLength(3);
  });

  it("linhas sem grupo produzem array vazio", () => {
    const group: ReportGroupConfig<Venda> = { by: "vendedor" };
    expect(groupRows([], group)).toEqual([]);
  });
});
