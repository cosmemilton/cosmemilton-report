import { beforeEach, describe, expect, it } from "vitest";
import { defaultReportGlobalConfig } from "../defaults.js";
import type { ReportView, SerializableReportDefinition } from "../types.js";
import { createLocalStorageReportAdapter } from "./local-storage-adapter.js";

/** Storage fake mínimo (interface `Storage`), usado para simular JSON corrompido sem depender
 *  do localStorage real do jsdom. */
class FakeStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

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

describe("createLocalStorageReportAdapter (jsdom localStorage real)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('usa o prefixo default "cm-report" nas chaves', async () => {
    const adapter = createLocalStorageReportAdapter();
    await adapter.saveGlobalConfig(defaultReportGlobalConfig);
    expect(window.localStorage.getItem("cm-report:config")).not.toBeNull();
  });

  it("aceita prefixo customizado", async () => {
    const adapter = createLocalStorageReportAdapter({ prefix: "meu-app" });
    await adapter.saveView(makeView());
    expect(window.localStorage.getItem("meu-app:views")).not.toBeNull();
    expect(window.localStorage.getItem("cm-report:views")).toBeNull();
  });

  it("começa sem config global e permite salvar/carregar", async () => {
    const adapter = createLocalStorageReportAdapter();
    expect(await adapter.loadGlobalConfig()).toBeNull();

    await adapter.saveGlobalConfig(defaultReportGlobalConfig);
    expect(await adapter.loadGlobalConfig()).toEqual(defaultReportGlobalConfig);
  });

  it("grava e relê uma view com round-trip fiel (critério de aceite 6)", async () => {
    const adapter = createLocalStorageReportAdapter();
    const view: ReportView = {
      id: "v1",
      slug: "vendas",
      name: "Minha view",
      isSystem: false,
      isDefault: true,
      columns: [
        {
          key: "total",
          header: "Total geral",
          width: "30%",
          align: "right",
          format: "currency",
          visible: true,
          sortOrder: 1,
        },
      ],
      header: { title: "Título", showLogo: false },
      style: { fontSize: 9, density: "compact" },
      summary: [{ label: "Total", sourceColumn: "total", operation: "sum", format: "currency" }],
      updatedAt: "2026-08-04T12:00:00.000Z",
    };

    await adapter.saveView(view);
    expect(await adapter.getView("v1")).toEqual(view);
    expect(await adapter.listViews("vendas")).toEqual([view]);
  });

  it("saveView faz upsert por id", async () => {
    const adapter = createLocalStorageReportAdapter();
    await adapter.saveView(makeView());
    await adapter.saveView(makeView({ name: "Renomeada" }));
    const views = await adapter.listViews();
    expect(views).toHaveLength(1);
    expect(views[0].name).toBe("Renomeada");
  });

  it("listViews sem slug retorna todas as views", async () => {
    const adapter = createLocalStorageReportAdapter();
    await adapter.saveView(makeView({ id: "v1", slug: "vendas" }));
    await adapter.saveView(makeView({ id: "v2", slug: "clientes" }));
    const all = await adapter.listViews();
    expect(all.map((v) => v.id).sort()).toEqual(["v1", "v2"]);
  });

  it("deleteView lança ao tentar excluir view do sistema", async () => {
    const adapter = createLocalStorageReportAdapter();
    await adapter.saveView(makeView({ id: "system:vendas", isSystem: true, isDefault: true }));
    await expect(adapter.deleteView("system:vendas")).rejects.toThrow();
    expect(await adapter.getView("system:vendas")).not.toBeNull();
  });

  it("deleteView remove view comum", async () => {
    const adapter = createLocalStorageReportAdapter();
    await adapter.saveView(makeView());
    await adapter.deleteView("v1");
    expect(await adapter.getView("v1")).toBeNull();
  });

  it("setDefaultView desmarca as demais views do mesmo slug", async () => {
    const adapter = createLocalStorageReportAdapter();
    await adapter.saveView(makeView({ id: "v1", slug: "vendas", isDefault: true }));
    await adapter.saveView(makeView({ id: "v2", slug: "vendas", isDefault: false }));

    await adapter.setDefaultView("vendas", "v2");

    const views = await adapter.listViews("vendas");
    expect(views.find((v) => v.id === "v1")?.isDefault).toBe(false);
    expect(views.find((v) => v.id === "v2")?.isDefault).toBe(true);
  });

  it("saveDefinition faz upsert por slug e deleteDefinition remove views do slug junto", async () => {
    const adapter = createLocalStorageReportAdapter();
    const definition: SerializableReportDefinition = {
      slug: "vendas",
      name: "Vendas",
      columns: [{ key: "total", header: "Total" }],
    };
    await adapter.saveDefinition(definition);
    expect(await adapter.listDefinitions()).toEqual([definition]);

    const updated = { ...definition, name: "Vendas (atualizado)" };
    await adapter.saveDefinition(updated);
    expect(await adapter.listDefinitions()).toEqual([updated]);

    await adapter.saveView(makeView({ id: "system:vendas", slug: "vendas", isSystem: true }));
    await adapter.saveView(makeView({ id: "v-outro", slug: "clientes" }));

    await adapter.deleteDefinition("vendas");
    expect(await adapter.getDefinition("vendas")).toBeNull();
    expect(await adapter.listViews("vendas")).toEqual([]);
    expect(await adapter.getView("v-outro")).not.toBeNull();
  });
});

describe("createLocalStorageReportAdapter (JSON corrompido)", () => {
  it("sobrevive a views corrompidas: retorna lista vazia, não lança (critério de aceite 6)", async () => {
    const fake = new FakeStorage();
    fake.setItem("cm-report:views", "{corrompido");
    const adapter = createLocalStorageReportAdapter({ storage: fake });

    await expect(adapter.listViews()).resolves.toEqual([]);
    await expect(adapter.getView("v1")).resolves.toBeNull();
  });

  it("sobrevive a config corrompida: retorna null, não lança", async () => {
    const fake = new FakeStorage();
    fake.setItem("cm-report:config", "{corrompido");
    const adapter = createLocalStorageReportAdapter({ storage: fake });

    await expect(adapter.loadGlobalConfig()).resolves.toBeNull();
  });

  it("sobrevive a definições corrompidas: retorna lista vazia, não lança", async () => {
    const fake = new FakeStorage();
    fake.setItem("cm-report:definitions", "não é json válido {{{");
    const adapter = createLocalStorageReportAdapter({ storage: fake });

    await expect(adapter.listDefinitions()).resolves.toEqual([]);
  });

  it("filtra entradas inválidas dentro de um array de views que é JSON válido", async () => {
    const fake = new FakeStorage();
    fake.setItem(
      "cm-report:views",
      JSON.stringify([
        { id: "v1", slug: "vendas", isSystem: false, isDefault: false },
        { semSlug: true },
      ]),
    );
    const adapter = createLocalStorageReportAdapter({ storage: fake });

    const views = await adapter.listViews();
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe("v1");
  });

  it("funciona de ponta a ponta com storage fake injetado (critério de aceite 6)", async () => {
    const fake = new FakeStorage();
    const adapter = createLocalStorageReportAdapter({ storage: fake, prefix: "fake" });

    await adapter.saveView(makeView({ id: "v1" }));
    expect(await adapter.getView("v1")).toEqual(makeView({ id: "v1" }));
    expect(fake.getItem("fake:views")).not.toBeNull();
  });

  it("não acessa storage no factory (lazy) — só falha se getItem/setItem forem chamados", () => {
    // Sem storage injetado e sem window.localStorage disponível no factory, o adapter ainda
    // deve poder ser criado (o acesso a `window.localStorage` só acontece dentro dos métodos).
    expect(() => createLocalStorageReportAdapter()).not.toThrow();
  });
});
