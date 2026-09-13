"use client";

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { CmToastProvider } from "cosmemilton-ui/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryReportAdapter } from "../../core/storage/memory-adapter.js";
import type { SerializableReportDefinition } from "../../core/types.js";
import { CmReportDesigner } from "../designer/cm-report-designer.js";
import { CmReportLayoutEditor } from "./cm-report-layout-editor.js";

// O preview e o provider são reais: só a criação/renderização do PDF é simulada.
// Assim o erro percorre debounce -> toBlob -> onError -> toast -> novo render do editor.
const h = vi.hoisted(() => ({
  toBlob: vi.fn<() => Promise<Blob>>(),
  createReportDocument: vi.fn((input: unknown) => input),
}));

vi.mock("@react-pdf/renderer", () => ({ pdf: () => ({ toBlob: h.toBlob }) }));
vi.mock("../../pdf.js", () => ({ createReportDocument: h.createReportDocument }));

const definition: SerializableReportDefinition = {
  slug: "clientes",
  name: "Clientes",
  columns: [{ key: "nome", header: "Nome" }],
};

beforeEach(() => {
  vi.useFakeTimers();
  h.toBlob.mockReset().mockRejectedValue(new Error("Falha ao carregar a imagem do PDF"));
  h.createReportDocument.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("preview e toasts dos editores", () => {
  it.each(["layout", "designer"])(
    "%s: falha do PDF gera uma única notificação sem reiniciar o preview, inclusive ao expirar o toast",
    async (editor) => {
      render(
        <CmToastProvider>
          {editor === "layout" ? (
            <CmReportLayoutEditor
              definition={definition}
              view={{
                id: "clientes-personalizado",
                slug: "clientes",
                name: "Personalizado",
                isSystem: false,
                isDefault: true,
              }}
              onViewChange={vi.fn()}
            />
          ) : (
            <CmReportDesigner
              definition={definition}
              dataSources={[]}
              adapter={createMemoryReportAdapter()}
            />
          )}
        </CmToastProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(h.toBlob).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Não foi possível gerar a pré-visualização.")).toBeInTheDocument();
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar a imagem do PDF");

      // Mais de duas janelas de debounce: o render disparado pelo toast não pode gerar PDF.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1800);
      });
      expect(h.toBlob).toHaveBeenCalledTimes(1);

      // A expiração e a remoção também atualizam o provider e seus consumidores.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(h.toBlob).toHaveBeenCalledTimes(1);
      expect(h.createReportDocument).toHaveBeenCalledTimes(1);
    },
  );
});
