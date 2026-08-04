"use client";

// `vitest.setup.ts` já importa "@testing-library/jest-dom/vitest" em runtime, mas esse arquivo
// fica fora do `include` do tsconfig — sem este import aqui, `tsc --noEmit` não vê a
// augmentação de tipos de `Assertion` (ver `cm-report-layout-editor.test.tsx`).
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportDefinition, ReportView } from "../../core/types.js";
import { CmReportPdfPreview } from "./cm-report-pdf-preview.js";

// `@react-pdf/renderer` e `../../pdf.js` (que o reexporta) são carregados via `import()` dinâmico
// pelo componente — `vi.mock` intercepta esses imports dinâmicos do mesmo jeito que intercepta
// imports estáticos (mesmo padrão usado para o `leaflet` em `cosmemilton-ui/map.test.tsx`).
// `vi.hoisted` porque as factories de `vi.mock` são içadas para o topo do arquivo.
const h = vi.hoisted(() => {
  const toBlobMock = vi.fn(async () => new Blob(["%PDF-mock"]));
  const pdfMock = vi.fn(() => ({ toBlob: toBlobMock }));
  const createReportDocumentMock = vi.fn((input: unknown) => input);
  return { toBlobMock, pdfMock, createReportDocumentMock };
});

vi.mock("@react-pdf/renderer", () => ({
  pdf: h.pdfMock,
}));

vi.mock("../../pdf.js", () => ({
  createReportDocument: h.createReportDocumentMock,
}));

type Venda = { data: string; cliente: string; total: number };

const definition: ReportDefinition<Venda> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date" },
    { key: "cliente", header: "Cliente" },
    { key: "total", header: "Total", format: "currency" },
  ],
};

const rows: Venda[] = [{ data: "2026-01-05", cliente: "Ana", total: 100 }];

function makeView(id: string): ReportView {
  return { id, slug: "vendas", name: id, isSystem: false, isDefault: true };
}

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let objectUrlCounter: number;

beforeEach(() => {
  vi.useFakeTimers();

  objectUrlCounter = 0;
  createObjectURL = vi.fn(() => `blob:mock-url-${++objectUrlCounter}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

  h.pdfMock.mockClear();
  h.createReportDocumentMock.mockClear();
  h.toBlobMock.mockReset();
  h.toBlobMock.mockImplementation(async () => new Blob(["%PDF-mock"]));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CmReportPdfPreview", () => {
  it("debounça: render inicial + 3 mudanças de view dentro de 200ms geram o PDF só 1 vez", async () => {
    const { rerender } = render(
      <CmReportPdfPreview definition={definition} rows={rows} view={makeView("v0")} />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    rerender(<CmReportPdfPreview definition={definition} rows={rows} view={makeView("v1")} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    rerender(<CmReportPdfPreview definition={definition} rows={rows} view={makeView("v2")} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    rerender(<CmReportPdfPreview definition={definition} rows={rows} view={makeView("v3")} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    // Total decorrido desde a última mudança: 50ms — ainda dentro da janela padrão de 600ms.
    expect(h.pdfMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(h.pdfMock).toHaveBeenCalledTimes(1);
  });

  it("iframe com o título correto aparece após a geração bem-sucedida", async () => {
    render(<CmReportPdfPreview definition={definition} rows={rows} debounceMs={100} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const iframe = screen.getByTitle("Pré-visualização do relatório");
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe("blob:mock-url-1#toolbar=0");
  });

  it("uma nova geração revoga o objectURL anterior", async () => {
    const { rerender } = render(
      <CmReportPdfPreview
        definition={definition}
        rows={rows}
        view={makeView("v0")}
        debounceMs={100}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    rerender(
      <CmReportPdfPreview
        definition={definition}
        rows={rows}
        view={makeView("v1")}
        debounceMs={100}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url-1");

    const iframe = screen.getByTitle("Pré-visualização do relatório");
    expect(iframe.getAttribute("src")).toBe("blob:mock-url-2#toolbar=0");
  });

  it("toBlob rejeitando exibe a mensagem de erro em pt-BR e chama onError com o Error", async () => {
    const onError = vi.fn();
    const failure = new Error("falha simulada no react-pdf");
    h.toBlobMock.mockImplementation(async () => {
      throw failure;
    });

    render(
      <CmReportPdfPreview definition={definition} rows={rows} debounceMs={100} onError={onError} />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Não foi possível gerar a pré-visualização.")).toBeInTheDocument();
    expect(screen.queryByTitle("Pré-visualização do relatório")).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("desmontar durante uma geração pendente não atualiza estado (sem warning de act)", async () => {
    let resolveToBlob: (blob: Blob) => void = () => {};
    h.toBlobMock.mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolveToBlob = resolve;
        }),
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(
      <CmReportPdfPreview definition={definition} rows={rows} debounceMs={100} />,
    );

    // Dispara a geração (debounce vencido) — `toBlob` fica pendente (controlado acima).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(h.pdfMock).toHaveBeenCalledTimes(1);

    unmount();

    // Resolve a geração DEPOIS do unmount — não deve tentar aplicar estado ao componente
    // desmontado (o token invalidado no cleanup faz o resultado ser descartado).
    await act(async () => {
      resolveToBlob(new Blob(["%PDF-mock"]));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    // O objectURL criado após o desmonte é descartado (revogado), não vazado.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url-1");

    consoleErrorSpy.mockRestore();
  });
});
