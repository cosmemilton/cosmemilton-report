import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMemoryReportAdapter } from "../core/storage/memory-adapter.js";
import type { SerializableReportDefinition } from "../core/types.js";
import { useReportDefinitions } from "./use-report-definitions.js";

const validDefinition: SerializableReportDefinition = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date" },
    { key: "total", header: "Total", format: "currency" },
  ],
};

describe("useReportDefinitions", () => {
  it("lista as definições existentes no mount", async () => {
    const adapter = createMemoryReportAdapter();
    await adapter.saveDefinition(validDefinition);

    const { result } = renderHook(() => useReportDefinitions({ adapter }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.definitions).toHaveLength(1);
    expect(result.current.definitions[0].slug).toBe("vendas");
    expect(result.current.error).toBeNull();
  });

  it("save com definição inválida (sem columns) seta error pt-BR e não grava", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportDefinitions({ adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalid: SerializableReportDefinition = { slug: "vazio", name: "Vazio", columns: [] };

    await act(async () => {
      await expect(result.current.save(invalid)).rejects.toThrow();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.definitions).toHaveLength(0);
    expect(await adapter.getDefinition("vazio")).toBeNull();
  });

  it("save com definição válida grava no adapter e aparece em definitions", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportDefinitions({ adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.save(validDefinition);
    });

    await waitFor(() => expect(result.current.definitions).toHaveLength(1));
    expect(result.current.definitions[0].slug).toBe("vendas");
    expect(result.current.error).toBeNull();
    expect(await adapter.getDefinition("vendas")).not.toBeNull();
  });

  it("remove exclui a definição e atualiza a lista", async () => {
    const adapter = createMemoryReportAdapter();
    await adapter.saveDefinition(validDefinition);
    const { result } = renderHook(() => useReportDefinitions({ adapter }));
    await waitFor(() => expect(result.current.definitions).toHaveLength(1));

    await act(async () => {
      await result.current.remove("vendas");
    });

    await waitFor(() => expect(result.current.definitions).toHaveLength(0));
    expect(await adapter.getDefinition("vendas")).toBeNull();
  });

  it("refresh recarrega a lista a partir do adapter", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportDefinitions({ adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.definitions).toHaveLength(0);

    // grava direto no adapter (sem passar pelo hook) e força refresh.
    await adapter.saveDefinition(validDefinition);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.definitions).toHaveLength(1);
  });
});
