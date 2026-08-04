import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMemoryReportAdapter } from "../core/storage/memory-adapter.js";
import type { ReportDefinition } from "../core/types.js";
import { useReportViews } from "./use-report-views.js";

// Tipada como `ReportDefinition<unknown>` (mesmo tipo aceito por `useReportViews`/
// `createSystemView`, ver `core/storage/provision.test.ts`) — evita o atrito de contravariância
// de `exportValue`/`pdfRender` entre `ReportDefinition<Venda>` e `ReportDefinition<unknown>`.
const definition: ReportDefinition<unknown> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date" },
    { key: "cliente", header: "Cliente" },
    { key: "total", header: "Total", format: "currency" },
  ],
};

describe("useReportViews", () => {
  it("no mount, com adapter vazio, provisiona a view system default do slug", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0]).toMatchObject({
      id: "system:vendas",
      isSystem: true,
      isDefault: true,
    });
    expect(result.current.activeView?.id).toBe("system:vendas");
    expect(result.current.selectedView?.id).toBe("system:vendas");
    expect(result.current.error).toBeNull();
  });

  it("duplicateView cria uma cópia editável (não-system) com novo id", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let copy: Awaited<ReturnType<typeof result.current.duplicateView>>;
    await act(async () => {
      copy = await result.current.duplicateView("system:vendas");
    });

    expect(copy!.id).not.toBe("system:vendas");
    expect(copy!.isSystem).toBe(false);
    expect(copy!.isDefault).toBe(false);
    expect(copy!.name).toBe("Cópia de Padrão do sistema");

    await waitFor(() => expect(result.current.views).toHaveLength(2));
    expect(result.current.views.some((v) => v.id === copy!.id)).toBe(true);
  });

  it("duplicateView aceita um nome customizado", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let copy: Awaited<ReturnType<typeof result.current.duplicateView>>;
    await act(async () => {
      copy = await result.current.duplicateView("system:vendas", "Minha view");
    });

    expect(copy!.name).toBe("Minha view");
  });

  it("saveView de uma view isSystem rejeita: seta error e lança", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const systemView = result.current.views[0];
    await act(async () => {
      await expect(result.current.saveView(systemView)).rejects.toThrow();
    });

    expect(result.current.error).toBeTruthy();
    // não deve ter alterado nada no adapter
    expect(await adapter.getView("system:vendas")).toMatchObject({ isSystem: true });
  });

  it("saveView de uma view não-system grava normalmente e atualiza a lista", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let copy: Awaited<ReturnType<typeof result.current.duplicateView>>;
    await act(async () => {
      copy = await result.current.duplicateView("system:vendas");
    });

    await act(async () => {
      await result.current.saveView({ ...copy!, name: "Renomeada" });
    });

    await waitFor(() =>
      expect(result.current.views.find((v) => v.id === copy!.id)?.name).toBe("Renomeada"),
    );
  });

  it("setDefault move a flag isDefault para a view escolhida", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let copy: Awaited<ReturnType<typeof result.current.duplicateView>>;
    await act(async () => {
      copy = await result.current.duplicateView("system:vendas");
    });

    await act(async () => {
      await result.current.setDefault(copy!.id);
    });

    await waitFor(() => {
      const system = result.current.views.find((v) => v.id === "system:vendas");
      const dup = result.current.views.find((v) => v.id === copy!.id);
      expect(system?.isDefault).toBe(false);
      expect(dup?.isDefault).toBe(true);
    });
    expect(result.current.activeView?.id).toBe(copy!.id);
  });

  it("selectView troca a selectedView; deleteView da selecionada volta para activeView", async () => {
    const adapter = createMemoryReportAdapter();
    const { result } = renderHook(() => useReportViews({ slug: "vendas", definition, adapter }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let copy: Awaited<ReturnType<typeof result.current.duplicateView>>;
    await act(async () => {
      copy = await result.current.duplicateView("system:vendas");
    });

    act(() => {
      result.current.selectView(copy!.id);
    });
    expect(result.current.selectedView?.id).toBe(copy!.id);

    await act(async () => {
      await result.current.deleteView(copy!.id);
    });

    await waitFor(() => expect(result.current.views).toHaveLength(1));
    expect(result.current.selectedView?.id).toBe(result.current.activeView?.id);
  });
});
