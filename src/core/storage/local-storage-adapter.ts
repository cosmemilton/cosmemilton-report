// Adapter de localStorage: uma chave por "tabela" (config/views/definitions), sempre um array
// (ou objeto) único em JSON. TODA leitura passa pelos parsers defensivos de `parse.ts` — JSON
// corrompido nunca lança, é tratado como vazio.
import { parseReportDefinition, parseReportGlobalConfig, parseReportView } from "../parse.js";
import type { ReportGlobalConfig, ReportView, SerializableReportDefinition } from "../types.js";
import type { ReportStorageAdapter } from "./adapter.js";

const DEFAULT_PREFIX = "cm-report";

/** Lê e faz `JSON.parse` de uma chave. `undefined` cobre tanto "chave ausente" quanto "JSON
 *  corrompido" — quem chama trata os dois casos como "nada salvo". Nunca lança. */
function readJson(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

/**
 * Cria um `ReportStorageAdapter` sobre `localStorage` (ou outro `Storage` injetado).
 * `options.storage` é acessado de forma preguiçosa DENTRO de cada método (nunca no factory),
 * para não quebrar em SSR — o factory pode ser chamado no servidor desde que os métodos só
 * sejam invocados no cliente.
 */
export function createLocalStorageReportAdapter(options?: {
  prefix?: string;
  storage?: Storage;
}): ReportStorageAdapter {
  const prefix = options?.prefix ?? DEFAULT_PREFIX;
  const configKey = `${prefix}:config`;
  const viewsKey = `${prefix}:views`;
  const definitionsKey = `${prefix}:definitions`;

  function getStorage(): Storage {
    return options?.storage ?? window.localStorage;
  }

  function readViews(storage: Storage): ReportView[] {
    const raw = readJson(storage, viewsKey);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map(parseReportView).filter((view): view is ReportView => view !== null);
  }

  function writeViews(storage: Storage, views: ReportView[]): void {
    writeJson(storage, viewsKey, views);
  }

  function readDefinitions(storage: Storage): SerializableReportDefinition[] {
    const raw = readJson(storage, definitionsKey);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map(parseReportDefinition)
      .filter((definition): definition is SerializableReportDefinition => definition !== null);
  }

  function writeDefinitions(storage: Storage, definitions: SerializableReportDefinition[]): void {
    writeJson(storage, definitionsKey, definitions);
  }

  return {
    async loadGlobalConfig(): Promise<ReportGlobalConfig | null> {
      const raw = readJson(getStorage(), configKey);
      return raw === undefined ? null : parseReportGlobalConfig(raw);
    },
    async saveGlobalConfig(config) {
      writeJson(getStorage(), configKey, config);
    },

    async listViews(slug) {
      const views = readViews(getStorage());
      return slug ? views.filter((view) => view.slug === slug) : views;
    },
    async getView(id) {
      return readViews(getStorage()).find((view) => view.id === id) ?? null;
    },
    async saveView(view) {
      const storage = getStorage();
      const views = readViews(storage);
      const index = views.findIndex((existing) => existing.id === view.id);
      if (index >= 0) {
        views[index] = view;
      } else {
        views.push(view);
      }
      writeViews(storage, views);
    },
    async deleteView(id) {
      const storage = getStorage();
      const views = readViews(storage);
      const view = views.find((existing) => existing.id === id);
      if (view?.isSystem) {
        throw new Error(`Não é possível excluir a view do sistema "${id}".`);
      }
      writeViews(
        storage,
        views.filter((existing) => existing.id !== id),
      );
    },
    async setDefaultView(slug, viewId) {
      const storage = getStorage();
      const views = readViews(storage).map((view) =>
        view.slug === slug ? { ...view, isDefault: view.id === viewId } : view,
      );
      writeViews(storage, views);
    },

    async listDefinitions() {
      return readDefinitions(getStorage());
    },
    async getDefinition(slug) {
      return readDefinitions(getStorage()).find((definition) => definition.slug === slug) ?? null;
    },
    async saveDefinition(definition) {
      const storage = getStorage();
      const definitions = readDefinitions(storage);
      const index = definitions.findIndex((existing) => existing.slug === definition.slug);
      if (index >= 0) {
        definitions[index] = definition;
      } else {
        definitions.push(definition);
      }
      writeDefinitions(storage, definitions);
    },
    async deleteDefinition(slug) {
      const storage = getStorage();
      writeDefinitions(
        storage,
        readDefinitions(storage).filter((existing) => existing.slug !== slug),
      );
      writeViews(
        storage,
        readViews(storage).filter((existing) => existing.slug !== slug),
      );
    },
  };
}
