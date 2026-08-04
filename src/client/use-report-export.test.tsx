import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportDefinition } from "../core/types.js";
import { useReportExport } from "./use-report-export.js";

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

const rows: Venda[] = [
  { data: "2026-01-05", cliente: "Ana", total: 100 },
  { data: "2026-01-06", cliente: "Bruno", total: 200 },
];

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.spyOn>;
let fetchMock: ReturnType<typeof vi.fn>;

function fetchResponse(options: {
  ok: boolean;
  status: number;
  contentDisposition?: string;
  blobText?: string;
}) {
  return {
    ok: options.ok,
    status: options.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-disposition" ? (options.contentDisposition ?? null) : null,
    },
    blob: async () => new Blob([options.blobText ?? ""], { type: "application/pdf" }),
  };
}

beforeEach(() => {
  createObjectURL = vi.fn(() => "blob:mock-url");
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useReportExport — modo endpoint", () => {
  it("chama fetch com ?format=...&params, baixa o blob e extrai o fileName do Content-Disposition", async () => {
    fetchMock.mockResolvedValue(
      fetchResponse({
        ok: true,
        status: 200,
        contentDisposition: 'attachment; filename="relatorio-vendas.pdf"',
        blobText: "%PDF-1.4",
      }),
    );

    const { result } = renderHook(() =>
      useReportExport<Venda>({ endpoint: "/api/relatorios/vendas" }),
    );

    await act(async () => {
      await result.current.exportReport({ format: "pdf", params: { mes: "2026-08" } });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/relatorios/vendas");
    expect(calledUrl).toContain("?format=pdf&mes=2026-08");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    expect(result.current.isExporting).toBe(false);
    expect(result.current.lastError).toBeNull();
  });

  it("res 500 → lastError preenchido em pt-BR, isExporting volta a false, sem download", async () => {
    fetchMock.mockResolvedValue(fetchResponse({ ok: false, status: 500 }));

    const { result } = renderHook(() =>
      useReportExport<Venda>({ endpoint: "/api/relatorios/vendas" }),
    );

    await act(async () => {
      await result.current.exportReport({ format: "pdf" });
    });

    expect(result.current.isExporting).toBe(false);
    expect(result.current.lastError).toBeTruthy();
    expect(result.current.lastError).toContain("500");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("usa filename*=UTF-8'' (decodificado) quando presente, preferindo-o ao filename= ASCII", async () => {
    fetchMock.mockResolvedValue(
      fetchResponse({
        ok: true,
        status: 200,
        contentDisposition:
          "attachment; filename=\"relatorio.pdf\"; filename*=UTF-8''relat%C3%B3rio-agosto.pdf",
        blobText: "%PDF-1.4",
      }),
    );

    let capturedAnchor: HTMLAnchorElement | null = null;
    const createElementSpy = vi.spyOn(document, "createElement");

    const { result } = renderHook(() =>
      useReportExport<Venda>({ endpoint: "/api/relatorios/vendas" }),
    );
    await act(async () => {
      await result.current.exportReport({ format: "pdf" });
    });

    const anchorCall = createElementSpy.mock.results.find(
      (r) => (r.value as HTMLElement).tagName === "A",
    );
    capturedAnchor = anchorCall?.value as HTMLAnchorElement;
    expect(capturedAnchor.download).toBe("relatório-agosto.pdf");
  });
});

describe("useReportExport — modo client-side", () => {
  it("csv: gera e baixa sem chamar fetch; conteúdo do Blob começa com BOM", async () => {
    const { result } = renderHook(() => useReportExport<Venda>({ definition }));

    await act(async () => {
      await result.current.exportReport({ format: "csv", rows });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(result.current.lastError).toBeNull();
    expect(result.current.isExporting).toBe(false);
  });

  it("sem endpoint e sem definition: lança erro pt-BR e seta lastError", async () => {
    const { result } = renderHook(() => useReportExport<Venda>({}));

    await act(async () => {
      await expect(result.current.exportReport({ format: "csv", rows })).rejects.toThrow();
    });

    expect(result.current.lastError).toBeTruthy();
    expect(result.current.lastError).toMatch(/definition|endpoint/);
  });
});

describe("useReportExport — copyToClipboard", () => {
  it("escreve TSV (sem BOM, com tab) no clipboard mockado", async () => {
    const { result } = renderHook(() => useReportExport<Venda>({ definition }));

    await act(async () => {
      await result.current.copyToClipboard(rows);
    });

    const writeText = window.navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText).toHaveBeenCalledTimes(1);
    const tsv = writeText.mock.calls[0][0] as string;
    expect(tsv.charCodeAt(0)).not.toBe(0xfeff);
    expect(tsv).toContain("\t");
    expect(tsv.split("\n")[0]).toBe("Data\tCliente\tTotal");
  });
});
