import { describe, expect, it } from "vitest";
import { createReportRegistry } from "../registry.js";
import type { ReportDefinition } from "../types.js";
import { createMemoryReportAdapter } from "./memory-adapter.js";
import { createSystemView, ensureReportViews } from "./provision.js";

// Tipadas como `ReportDefinition<unknown>` (mesmo tipo aceito por `createSystemView`) para
// poderem ser passadas tanto ao registry quanto direto à função sob teste.
const vendas: ReportDefinition<unknown> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [{ key: "total", header: "Total", format: "currency" }],
};

const clientes: ReportDefinition<unknown> = {
  slug: "clientes",
  name: "Relatório de Clientes",
  columns: [{ key: "nome", header: "Nome" }],
};

describe("createSystemView", () => {
  it("cria a view system com id, flags e nome padrão", () => {
    const view = createSystemView(vendas);
    expect(view).toEqual({
      id: "system:vendas",
      slug: "vendas",
      name: "Padrão do sistema",
      isSystem: true,
      isDefault: true,
    });
  });

  it("não inclui overrides de coluna/cabeçalho/estilo", () => {
    const view = createSystemView(vendas);
    expect(view.columns).toBeUndefined();
    expect(view.header).toBeUndefined();
    expect(view.style).toBeUndefined();
    expect(view.summary).toBeUndefined();
  });
});

describe("ensureReportViews", () => {
  it("na primeira chamada cria as views system faltantes (critério de aceite 4)", async () => {
    const registry = createReportRegistry([vendas, clientes]);
    const adapter = createMemoryReportAdapter();

    const result = await ensureReportViews({ registry, adapter });

    expect(result.created.sort()).toEqual(["system:clientes", "system:vendas"]);
    expect(result.existing).toEqual([]);
    expect(await adapter.getView("system:vendas")).not.toBeNull();
    expect(await adapter.getView("system:clientes")).not.toBeNull();
  });

  it("na segunda chamada não recria nada — created: [] (critério de aceite 4)", async () => {
    const registry = createReportRegistry([vendas, clientes]);
    const adapter = createMemoryReportAdapter();

    await ensureReportViews({ registry, adapter });
    const second = await ensureReportViews({ registry, adapter });

    expect(second.created).toEqual([]);
    expect(second.existing.sort()).toEqual(["system:clientes", "system:vendas"]);
  });

  it("system view nasce isDefault:true quando o slug ainda não tem view default", async () => {
    const registry = createReportRegistry([vendas]);
    const adapter = createMemoryReportAdapter();

    await ensureReportViews({ registry, adapter });

    const systemView = await adapter.getView("system:vendas");
    expect(systemView?.isDefault).toBe(true);
  });

  it("slug que já tem view default de usuário: system criada nasce isDefault:false (critério de aceite 4)", async () => {
    const registry = createReportRegistry([vendas]);
    const adapter = createMemoryReportAdapter();
    await adapter.saveView({
      id: "user-view",
      slug: "vendas",
      name: "View do usuário",
      isSystem: false,
      isDefault: true,
    });

    const result = await ensureReportViews({ registry, adapter });

    expect(result.created).toEqual(["system:vendas"]);
    const systemView = await adapter.getView("system:vendas");
    expect(systemView?.isDefault).toBe(false);
    // a view de usuário continua sendo a default.
    expect((await adapter.getView("user-view"))?.isDefault).toBe(true);
  });

  it("nunca sobrescreve uma view system já existente", async () => {
    const registry = createReportRegistry([vendas]);
    const adapter = createMemoryReportAdapter();
    await adapter.saveView({
      id: "system:vendas",
      slug: "vendas",
      name: "Nome customizado (não deveria ser tocado)",
      isSystem: true,
      isDefault: false,
    });

    await ensureReportViews({ registry, adapter });

    const systemView = await adapter.getView("system:vendas");
    expect(systemView?.name).toBe("Nome customizado (não deveria ser tocado)");
    expect(systemView?.isDefault).toBe(false);
  });

  it("registry vazio não cria nada", async () => {
    const registry = createReportRegistry([]);
    const adapter = createMemoryReportAdapter();

    const result = await ensureReportViews({ registry, adapter });
    expect(result).toEqual({ created: [], existing: [] });
  });
});
