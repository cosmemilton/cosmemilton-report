import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CmToastProvider } from "cosmemilton-ui/client";
import type { ReportGlobalConfig } from "../core/types.js";
import { CmReportGlobalConfigEditor } from "./global-config-editor.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor(initialValue: Partial<ReportGlobalConfig> = {}) {
  const onChange = vi.fn();

  function Harness() {
    const [value, setValue] = useState(initialValue);
    return (
      <CmToastProvider>
        <CmReportGlobalConfigEditor
          value={value}
          onChange={(patch) => {
            onChange(patch);
            setValue((current) => ({ ...current, ...patch }));
          }}
        />
      </CmToastProvider>
    );
  }

  render(<Harness />);
  return { onChange };
}

describe("CmReportGlobalConfigEditor", () => {
  it.each(["58", "80"])(
    "seleciona bobina de %s mm, aplica margens térmicas e permite voltar a A4",
    async (width) => {
      const user = userEvent.setup();
      const { onChange } = renderEditor({ orientation: "landscape" });

      expect(screen.getByLabelText("Superior")).toHaveValue("15");
      expect(screen.getByLabelText("Esquerda")).toHaveValue("10");

      await user.click(screen.getByRole("combobox", { name: "Papel" }));
      await user.click(screen.getByRole("option", { name: `Bobina ${width} mm (PDV)` }));

      expect(onChange).toHaveBeenLastCalledWith({
        paperSize: `${width}mm`,
        orientation: "portrait",
      });
      expect(screen.getByRole("combobox", { name: "Papel" })).toHaveTextContent(
        `Bobina ${width} mm (PDV)`,
      );
      const orientation = screen.getByRole("combobox", { name: "Orientação" });
      expect(orientation).toBeDisabled();
      expect(orientation).toHaveTextContent("Retrato");
      for (const margin of ["Superior", "Inferior", "Esquerda", "Direita"]) {
        expect(screen.getByLabelText(margin)).toHaveValue("3");
      }

      await user.click(screen.getByRole("combobox", { name: "Papel" }));
      await user.click(screen.getByRole("option", { name: "A4" }));

      expect(onChange).toHaveBeenLastCalledWith({ paperSize: "A4" });
      expect(orientation).toBeEnabled();
      expect(screen.getByLabelText("Superior")).toHaveValue("15");
      expect(screen.getByLabelText("Inferior")).toHaveValue("15");
      expect(screen.getByLabelText("Esquerda")).toHaveValue("10");
      expect(screen.getByLabelText("Direita")).toHaveValue("10");
    },
  );

  it("preserva margens explícitas ao trocar o papel, inclusive margem zero", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor({
      marginTopMm: 7,
      marginBottomMm: 0,
      marginLeftMm: 10,
    });

    await user.click(screen.getByRole("combobox", { name: "Papel" }));
    await user.click(screen.getByRole("option", { name: "Bobina 58 mm (PDV)" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      paperSize: "58mm",
      orientation: "portrait",
    });
    expect(screen.getByLabelText("Superior")).toHaveValue("7");
    expect(screen.getByLabelText("Inferior")).toHaveValue("0");
    expect(screen.getByLabelText("Esquerda")).toHaveValue("10");
    expect(screen.getByLabelText("Direita")).toHaveValue("3");
  });

  it("exibe retrato ao abrir uma configuração térmica que ainda contém paisagem", () => {
    const { onChange } = renderEditor({ paperSize: "80mm", orientation: "landscape" });

    expect(screen.getByRole("combobox", { name: "Orientação" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Orientação" })).toHaveTextContent("Retrato");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("carrega logotipo como data URI e informa o carregamento em um toast", async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();
    const file = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Enviar imagem"), file);

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        logoUrl: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    );
    expect(screen.getByRole("img", { name: "Pré-visualização do logotipo" })).toHaveAttribute(
      "src",
      onChange.mock.calls[0][0].logoUrl,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Logotipo carregado.");
    expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--success");
    expect(screen.getByLabelText("Enviar imagem")).toHaveValue("");
  });

  it("informa arquivo inválido sem substituir o logotipo existente", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { onChange } = renderEditor({ logoUrl: "https://example.com/logo.png" });

    await user.upload(
      screen.getByLabelText("Enviar imagem"),
      new File(["texto"], "documento.txt", { type: "text/plain" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Selecione um arquivo de imagem.");
    expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--danger");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Pré-visualização do logotipo" })).toHaveAttribute(
      "src",
      "https://example.com/logo.png",
    );
  });

  it.each(["error", "abort", "throw", "invalid-result"])(
    "informa falha de leitura (%s) sem emitir patch",
    async (failure) => {
      const user = userEvent.setup();
      const { onChange } = renderEditor();
      vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (
        this: FileReader,
      ) {
        if (failure === "throw") {
          throw new Error("Falha de leitura");
        }
        this.dispatchEvent(new ProgressEvent(failure === "invalid-result" ? "load" : failure));
      });

      await user.upload(
        screen.getByLabelText("Enviar imagem"),
        new File(["imagem"], "logo.png", { type: "image/png" }),
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível carregar a imagem. Tente novamente.",
      );
      expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--danger");
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("cancelar o seletor de arquivo não emite toast nem patch", () => {
    const { onChange } = renderEditor();

    fireEvent.change(screen.getByLabelText("Enviar imagem"), { target: { files: [] } });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
