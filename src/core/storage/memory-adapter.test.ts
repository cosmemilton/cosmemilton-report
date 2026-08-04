import { describe, expect, it } from "vitest";
import { defaultReportGlobalConfig } from "../defaults.js";
import type { ReportView } from "../types.js";
import { createMemoryReportAdapter } from "./memory-adapter.js";

function makeView(overrides: Partial<ReportView> = {}): ReportView {
  return {
    id: "v1",
    slug: "vendas",
    name: "View 1",
    isSystem: false,
    isDefault: false,
    ...overrides,
  };
}

describe("createMemoryReportAdapter", () => {
  it("começa sem config global e permite salvar/carregar", async () => {
    const adapter = createMemoryReportAdapter();
    expect(await adapter.loadGlobalConfig()).toBeNull();

    await adapter.saveGlobalConfig(defaultReportGlobalConfig);
    expect(await adapter.loadGlobalConfig()).toEqual(defaultReportGlobalConfig);
  });

  it("aceita seed de config global e views", async () => {
    const seededView = makeView({ id: "system:vendas", isSystem: true, isDefault: true });
    const adapter = createMemoryReportAdapter({
      globalConfig: defaultReportGlobalConfig,
      views: [seededView],
    });

    expect(await adapter.loadGlobalConfig()).toEqual(defaultReportGlobalConfig);
    expect(await adapter.getView("system:vendas")).toEqual(seededView);
  });

  it("salva, lista, busca e faz upsert de views por id", async () => {
    const adapter = createMemoryReportAdapter();
    const view = makeView();
    await adapter.saveView(view);

    expect(await adapter.getView("v1")).toEqual(view);
    expect(await adapter.listViews()).toEqual([view]);
    expect(await adapter.listViews("vendas")).toEqual([view]);
    expect(await adapter.listViews("clientes")).toEqual([]);

    const updated = { ...view, name: "View renomeada" };
    await adapter.saveView(updated);
    expect(await adapter.listViews()).toEqual([updated]);
  });

  it("listViews sem slug retorna todas as views de todos os relatórios", async () => {
    const adapter = createMemoryReportAdapter();
    await adapter.saveView(makeView({ id: "v1", slug: "vendas" }));
    await adapter.saveView(makeView({ id: "v2", slug: "clientes" }));

    const all = await adapter.listViews();
    expect(all.map((v) => v.id).sort()).toEqual(["v1", "v2"]);
  });

  it("deleteView remove view comum", async () => {
    const adapter = createMemoryReportAdapter();
    await adapter.saveView(makeView());
    await adapter.deleteView("v1");
    expect(await adapter.getView("v1")).toBeNull();
  });

  it("deleteView lança ao tentar excluir view do sistema (critério de aceite 5)", async () => {
    const adapter = createMemoryReportAdapter();
    await adapter.saveView(makeView({ id: "system:vendas", isSystem: true, isDefault: true }));

    await expect(adapter.deleteView("system:vendas")).rejects.toThrow();
    expect(await adapter.getView("system:vendas")).not.toBeNull();
  });

  it("setDefaultView marca a view escolhida e desmarca as demais do mesmo slug (critério de aceite 5)", async () => {
    const adapter = createMemoryReportAdapter();
    await adapter.saveView(makeView({ id: "v1", slug: "vendas", isDefault: true }));
    await adapter.saveView(makeView({ id: "v2", slug: "vendas", isDefault: false }));
    await adapter.saveView(makeView({ id: "v3", slug: "clientes", isDefault: true }));

    await adapter.setDefaultView("vendas", "v2");

    const vendasViews = await adapter.listViews("vendas");
    expect(vendasViews.find((v) => v.id === "v1")?.isDefault).toBe(false);
    expect(vendasViews.find((v) => v.id === "v2")?.isDefault).toBe(true);
    // não mexe em outros slugs.
    expect((await adapter.getView("v3"))?.isDefault).toBe(true);
  });

  it("saveDefinition faz upsert por slug", async () => {
    const adapter = createMemoryReportAdapter();
    const definition = {
      slug: "vendas",
      name: "Vendas",
      columns: [{ key: "total", header: "Total" }],
    };
    await adapter.saveDefinition(definition);
    expect(await adapter.listDefinitions()).toEqual([definition]);

    const updated = { ...definition, name: "Vendas (atualizado)" };
    await adapter.saveDefinition(updated);
    expect(await adapter.listDefinitions()).toEqual([updated]);
  });

  it("deleteDefinition remove a definição e todas as views do slug (critério de aceite 5)", async () => {
    const adapter = createMemoryReportAdapter();
    const definition = {
      slug: "vendas",
      name: "Vendas",
      columns: [{ key: "total", header: "Total" }],
    };
    await adapter.saveDefinition(definition);
    await adapter.saveView(makeView({ id: "system:vendas", slug: "vendas", isSystem: true }));
    await adapter.saveView(makeView({ id: "v-usuario", slug: "vendas" }));
    await adapter.saveView(makeView({ id: "v-outro", slug: "clientes" }));

    await adapter.deleteDefinition("vendas");

    expect(await adapter.getDefinition("vendas")).toBeNull();
    expect(await adapter.listViews("vendas")).toEqual([]);
    // views de outros slugs continuam intactas.
    expect(await adapter.getView("v-outro")).not.toBeNull();
  });
});
