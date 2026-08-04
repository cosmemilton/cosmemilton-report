// Adapter em memória: útil para testes e para apps que ainda não plugaram um storage real.
// Nada é persistido entre execuções — o `seed` opcional só popula o estado inicial.
import type { ReportGlobalConfig, ReportView, SerializableReportDefinition } from "../types.js";
import type { ReportStorageAdapter } from "./adapter.js";

/** Cria um `ReportStorageAdapter` que guarda tudo em `Map`s na memória do processo. */
export function createMemoryReportAdapter(seed?: {
  globalConfig?: ReportGlobalConfig;
  views?: ReportView[];
}): ReportStorageAdapter {
  let globalConfig: ReportGlobalConfig | null = seed?.globalConfig ?? null;
  const views = new Map<string, ReportView>();
  const definitions = new Map<string, SerializableReportDefinition>();

  for (const view of seed?.views ?? []) {
    views.set(view.id, view);
  }

  return {
    async loadGlobalConfig() {
      return globalConfig;
    },
    async saveGlobalConfig(config) {
      globalConfig = config;
    },

    async listViews(slug) {
      const all = Array.from(views.values());
      return slug ? all.filter((view) => view.slug === slug) : all;
    },
    async getView(id) {
      return views.get(id) ?? null;
    },
    async saveView(view) {
      views.set(view.id, view);
    },
    async deleteView(id) {
      const view = views.get(id);
      if (view?.isSystem) {
        throw new Error(`Não é possível excluir a view do sistema "${id}".`);
      }
      views.delete(id);
    },
    async setDefaultView(slug, viewId) {
      for (const view of views.values()) {
        if (view.slug === slug) {
          views.set(view.id, { ...view, isDefault: view.id === viewId });
        }
      }
    },

    async listDefinitions() {
      return Array.from(definitions.values());
    },
    async getDefinition(slug) {
      return definitions.get(slug) ?? null;
    },
    async saveDefinition(definition) {
      definitions.set(definition.slug, definition);
    },
    async deleteDefinition(slug) {
      definitions.delete(slug);
      for (const view of Array.from(views.values())) {
        if (view.slug === slug) {
          views.delete(view.id);
        }
      }
    },
  };
}
