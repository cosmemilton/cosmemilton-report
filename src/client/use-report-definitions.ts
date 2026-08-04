"use client";

// useReportDefinitions — CRUD das `SerializableReportDefinition`s salvas pelo designer, via
// `ReportStorageAdapter`. `save` sempre passa a definição por `parseReportDefinition` antes de
// gravar (parsing defensivo — mesma fronteira de persistência do resto do core): uma definição
// sem slug/name/columns válidos nunca chega ao adapter.
import { useCallback, useEffect, useRef, useState } from "react";
import { parseReportDefinition } from "../core/parse.js";
import type { SerializableReportDefinition } from "../core/types.js";
import type { ReportStorageAdapter } from "../core/storage/adapter.js";

export type UseReportDefinitionsOptions = {
  adapter: ReportStorageAdapter;
};

export type UseReportDefinitionsReturn = {
  definitions: SerializableReportDefinition[];
  /** Valida via `parseReportDefinition` antes de gravar — inválida seta `error` e lança. */
  save: (definition: SerializableReportDefinition) => Promise<void>;
  remove: (slug: string) => Promise<void>;
  refresh: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

/**
 * Lista/gerencia as definições de relatório criadas em runtime (designer) via `adapter`.
 * Carrega no mount e sempre que `adapter` mudar.
 */
export function useReportDefinitions(
  options: UseReportDefinitionsOptions,
): UseReportDefinitionsReturn {
  const { adapter } = options;
  const [definitions, setDefinitions] = useState<SerializableReportDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const list = await adapter.listDefinitions();
      if (mountedRef.current) setDefinitions(list);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao carregar os relatórios salvos.";
      if (mountedRef.current) setError(message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda no mount e quando `adapter` muda
  }, [adapter]);

  const save = useCallback(
    async (definition: SerializableReportDefinition): Promise<void> => {
      const parsed = parseReportDefinition(definition);
      if (!parsed) {
        const message =
          "Relatório inválido: informe nome, slug e ao menos uma coluna (chave + rótulo) válidos.";
        if (mountedRef.current) setError(message);
        throw new Error(message);
      }

      try {
        await adapter.saveDefinition(parsed);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao salvar o relatório.";
        if (mountedRef.current) setError(message);
        throw err;
      }
    },
    [adapter, refresh],
  );

  const remove = useCallback(
    async (slug: string): Promise<void> => {
      try {
        await adapter.deleteDefinition(slug);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao remover o relatório.";
        if (mountedRef.current) setError(message);
        throw err;
      }
    },
    [adapter, refresh],
  );

  return { definitions, save, remove, refresh, isLoading, error };
}
