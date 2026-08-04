"use client";

// useReportViews — carrega/gerencia as `ReportView`s de um relatório via `ReportStorageAdapter`:
// provisiona a view "system" no mount (`ensureReportViews`), expõe a lista, a view "ativa"
// (default do slug) e a "selecionada" (controlável via `selectView`), e as mutações de CRUD.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createReportRegistry } from "../core/registry.js";
import type { ReportDefinition, ReportView } from "../core/types.js";
import { ensureReportViews } from "../core/storage/provision.js";
import type { ReportStorageAdapter } from "../core/storage/adapter.js";

export type UseReportViewsOptions = {
  slug: string;
  definition: ReportDefinition<unknown>;
  adapter: ReportStorageAdapter;
};

export type UseReportViewsReturn = {
  views: ReportView[];
  /** View default do slug — fallback: a view system, fallback: a primeira da lista. */
  activeView: ReportView | null;
  /** View controlada por `selectView`; antes da primeira seleção, é igual a `activeView`. */
  selectedView: ReportView | null;
  selectView: (id: string) => void;
  /** Cria uma cópia editável (`isSystem: false`, `isDefault: false`, novo id) da view `id`. */
  duplicateView: (id: string, name?: string) => Promise<ReportView>;
  /** Recusa salvar views `isSystem` (somente leitura). */
  saveView: (view: ReportView) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

/** Default do slug — fallback: view system, fallback: a primeira da lista (ou `null` se vazia). */
function pickActiveView(views: ReportView[]): ReportView | null {
  if (views.length === 0) {
    return null;
  }
  return views.find((view) => view.isDefault) ?? views.find((view) => view.isSystem) ?? views[0];
}

/**
 * Carrega as views de `slug` (provisionando a view system quando faltar) e expõe operações de
 * seleção/duplicação/gravação/exclusão sobre `adapter`. Recarrega no mount e sempre que
 * `slug`/`adapter` mudarem.
 */
export function useReportViews(options: UseReportViewsOptions): UseReportViewsReturn {
  const { slug, definition, adapter } = options;
  const [views, setViews] = useState<ReportView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshViews = useCallback(async () => {
    const list = await adapter.listViews(slug);
    if (mountedRef.current) setViews(list);
    return list;
  }, [adapter, slug]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const registry = createReportRegistry([definition]);
        await ensureReportViews({ registry, adapter });
        const list = await adapter.listViews(slug);
        if (!cancelled) setViews(list);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Falha ao carregar as views do relatório.";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Só `slug`/`adapter` disparam o reload (ver plano, Fase 7) — `definition` é lida do closure
    // desta execução do efeito, sem forçar recarga a cada nova identidade de objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, adapter]);

  const activeView = useMemo(() => pickActiveView(views), [views]);

  const selectedView = useMemo(() => {
    const selected = selectedViewId ? views.find((view) => view.id === selectedViewId) : undefined;
    return selected ?? activeView;
  }, [views, selectedViewId, activeView]);

  const selectView = useCallback((id: string) => {
    setSelectedViewId(id);
  }, []);

  const duplicateView = useCallback(
    async (id: string, name?: string): Promise<ReportView> => {
      const original = await adapter.getView(id);
      if (!original) {
        throw new Error(`useReportViews: view "${id}" não encontrada para duplicar.`);
      }

      const copy: ReportView = {
        ...original,
        id: crypto.randomUUID(),
        isSystem: false,
        isDefault: false,
        name: name ?? `Cópia de ${original.name}`,
      };

      await adapter.saveView(copy);
      await refreshViews();
      return copy;
    },
    [adapter, refreshViews],
  );

  const saveView = useCallback(
    async (view: ReportView): Promise<void> => {
      if (view.isSystem) {
        const message =
          "Não é possível salvar alterações na view do sistema — duplique-a para editar.";
        if (mountedRef.current) setError(message);
        throw new Error(message);
      }

      try {
        await adapter.saveView(view);
        await refreshViews();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao salvar a view do relatório.";
        if (mountedRef.current) setError(message);
        throw err;
      }
    },
    [adapter, refreshViews],
  );

  const deleteView = useCallback(
    async (id: string): Promise<void> => {
      try {
        await adapter.deleteView(id);
        await refreshViews();
        if (mountedRef.current && selectedViewId === id) {
          setSelectedViewId(null);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Falha ao excluir a view do relatório.";
        if (mountedRef.current) setError(message);
        throw err;
      }
    },
    [adapter, refreshViews, selectedViewId],
  );

  const setDefault = useCallback(
    async (id: string): Promise<void> => {
      try {
        await adapter.setDefaultView(slug, id);
        await refreshViews();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao definir a view padrão.";
        if (mountedRef.current) setError(message);
        throw err;
      }
    },
    [adapter, refreshViews, slug],
  );

  return {
    views,
    activeView,
    selectedView,
    selectView,
    duplicateView,
    saveView,
    deleteView,
    setDefault,
    isLoading,
    error,
  };
}
