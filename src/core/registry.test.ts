import { describe, expect, it } from "vitest";
import { createReportRegistry, mergeReportDefinitions } from "./registry.js";
import type { ReportDefinition, SerializableReportDefinition } from "./types.js";

const vendas: ReportDefinition<{ total: number }> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [{ key: "total", header: "Total", format: "currency" }],
};

const clientes: ReportDefinition<{ nome: string }> = {
  slug: "clientes",
  name: "Relatório de Clientes",
  columns: [{ key: "nome", header: "Nome" }],
};

describe("createReportRegistry", () => {
  it("lista, busca e checa existência por slug", () => {
    const registry = createReportRegistry([vendas, clientes]);
    expect(registry.slugs().sort()).toEqual(["clientes", "vendas"]);
    expect(registry.has("vendas")).toBe(true);
    expect(registry.has("inexistente")).toBe(false);
    expect(registry.get("vendas")?.name).toBe("Relatório de Vendas");
    expect(registry.get("inexistente")).toBeUndefined();
    expect(registry.list()).toHaveLength(2);
  });

  it("lança em slug duplicado", () => {
    const duplicada: ReportDefinition<{ total: number }> = { ...vendas, name: "Outra" };
    expect(() => createReportRegistry([vendas, duplicada])).toThrow(/duplicad/i);
  });
});

describe("mergeReportDefinitions", () => {
  it("descarta definição salva cujo slug já existe no código", () => {
    const storedVendas: SerializableReportDefinition = {
      slug: "vendas",
      name: "Vendas (versão salva, deve ser descartada)",
      columns: [{ key: "total", header: "Total" }],
    };
    const storedRelatorioNovo: SerializableReportDefinition = {
      slug: "relatorio-novo",
      name: "Relatório Novo",
      columns: [{ key: "campo", header: "Campo" }],
    };

    const merged = mergeReportDefinitions([vendas, clientes], [storedVendas, storedRelatorioNovo]);

    expect(merged.map((d) => d.slug).sort()).toEqual(["clientes", "relatorio-novo", "vendas"]);
    // código vence: a definição de "vendas" é a de código, não a salva.
    const mergedVendas = merged.find((d) => d.slug === "vendas");
    expect(mergedVendas?.name).toBe("Relatório de Vendas");
  });

  it("retorna só o código quando não há definições salvas", () => {
    const merged = mergeReportDefinitions([vendas], []);
    expect(merged).toEqual([vendas]);
  });
});
