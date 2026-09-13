"use client";

// `vitest.setup.ts` já importa "@testing-library/jest-dom/vitest" em runtime (todos os testes
// ganham os matchers), mas esse arquivo fica fora do `include` do tsconfig — sem este import
// aqui, `tsc --noEmit` não vê a augmentação de tipos de `Assertion` e os matchers (
// `toBeInTheDocument`, `toBeDisabled`, ...) não tipam. Importar o módulo (mesmo só pelo efeito
// colateral de tipos) em qualquer arquivo incluído no programa resolve para o programa inteiro.
import "@testing-library/jest-dom/vitest";
import { useState, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render as renderComponent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CmToastProvider } from "cosmemilton-ui/client";
import type { ReportDefinition, ReportView } from "../../core/types.js";
import type { CmReportPdfPreviewProps } from "../preview/cm-report-pdf-preview.js";
import { CmReportLayoutEditor } from "./cm-report-layout-editor.js";

// O preview real gera PDF de verdade (import dinâmico de @react-pdf/renderer) — fora do escopo
// deste arquivo, que testa só a integração (quais props o editor repassa a ele). O componente
// tem seu próprio conjunto de testes em `../preview/cm-report-pdf-preview.test.tsx`.
const h = vi.hoisted(() => ({ previewSpy: vi.fn() }));

vi.mock("../preview/cm-report-pdf-preview.js", () => ({
  CmReportPdfPreview: (props: CmReportPdfPreviewProps<unknown>) => {
    h.previewSpy(props);
    return <div data-testid="preview-mock" />;
  },
}));

afterEach(cleanup);
beforeEach(() => {
  h.previewSpy.mockClear();
});

function render(ui: ReactElement) {
  return renderComponent(ui, { wrapper: CmToastProvider });
}

type Venda = { data: string; cliente: string; total: number };

const definition: ReportDefinition<Venda> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date", width: "20%" },
    { key: "cliente", header: "Cliente", width: "50%" },
    { key: "total", header: "Total", format: "currency", width: "30%", hideable: false },
  ],
};

function makeView(overrides: Partial<ReportView> = {}): ReportView {
  return {
    id: "system:vendas",
    slug: "vendas",
    name: "Padrão do sistema",
    isSystem: false,
    isDefault: true,
    ...overrides,
  };
}

/** Renderiza o editor como um consumidor real faria: `view` vive em estado local, atualizado a
 *  cada `onViewChange`. `onViewChange` também é espionado, para as asserções dos testes. */
function renderEditor(
  initialView: ReportView,
  options: { onDuplicate?: () => void | Promise<void> } = {},
) {
  const onViewChange = vi.fn();

  function Harness() {
    const [view, setView] = useState(initialView);
    return (
      <CmReportLayoutEditor
        definition={definition}
        view={view}
        onViewChange={(next) => {
          onViewChange(next);
          setView(next);
        }}
        onDuplicate={options.onDuplicate}
      />
    );
  }

  render(<Harness />);
  return { onViewChange };
}

describe("CmReportLayoutEditor", () => {
  it("renderiza as 4 abas com rótulos pt-BR", () => {
    renderEditor(makeView());

    expect(screen.getByRole("tab", { name: "Colunas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cabeçalho" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sumário" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Estilo" })).toBeInTheDocument();
  });

  it("desmarcar o switch de uma coluna emite onViewChange só com o override dessa coluna", async () => {
    const user = userEvent.setup();
    const { onViewChange } = renderEditor(makeView());

    await user.click(screen.getByRole("switch", { name: /Cliente/ }));

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const nextView = onViewChange.mock.calls[0][0] as ReportView;
    expect(nextView.columns).toEqual([{ key: "cliente", visible: false }]);
  });

  it("clicar 'Mover para cima' na 2ª coluna troca o sortOrder efetivo", async () => {
    const user = userEvent.setup();
    const { onViewChange } = renderEditor(makeView());

    // Ordem efetiva inicial: Data, Cliente, Total — a 2ª coluna é "Cliente".
    const moveUpButtons = screen.getAllByRole("button", { name: "Mover para cima" });
    await user.click(moveUpButtons[1]);

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const nextView = onViewChange.mock.calls[0][0] as ReportView;
    expect(nextView.columns).toEqual([
      { key: "cliente", sortOrder: 0 },
      { key: "data", sortOrder: 1 },
      { key: "total", sortOrder: 2 },
    ]);
  });

  it("view isSystem desabilita os controles, mostra o aviso e 'Duplicar para editar' chama onDuplicate", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    renderEditor(makeView({ isSystem: true }), { onDuplicate });

    expect(screen.getByText("Visão do sistema — duplique para editar")).toBeInTheDocument();

    const duplicateButton = screen.getByRole("button", { name: "Duplicar para editar" });
    await user.click(duplicateButton);
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("switch", { name: /Cliente/ })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Mover para cima" })[0]).toBeDisabled();
  });

  it("coluna com hideable:false não tem switch de visibilidade", () => {
    renderEditor(makeView());

    expect(screen.queryByRole("switch", { name: /Total/ })).not.toBeInTheDocument();
  });

  it("editar o título na aba Cabeçalho emite onViewChange com header.title atualizado", async () => {
    const user = userEvent.setup();
    const { onViewChange } = renderEditor(makeView());

    await user.click(screen.getByRole("tab", { name: "Cabeçalho" }));
    await user.type(screen.getByLabelText("Título"), "Vendas 2026");

    expect(onViewChange).toHaveBeenCalled();
    const lastView = onViewChange.mock.calls.at(-1)?.[0] as ReportView;
    expect(lastView.header?.title).toBe("Vendas 2026");
  });

  it("adicionar item de sumário emite onViewChange com summary contendo o novo item", async () => {
    const user = userEvent.setup();
    const { onViewChange } = renderEditor(makeView());

    await user.click(screen.getByRole("tab", { name: "Sumário" }));
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const nextView = onViewChange.mock.calls[0][0] as ReportView;
    expect(nextView.summary).toHaveLength(1);
    expect(nextView.summary?.[0]).toMatchObject({
      label: "Novo item",
      sourceColumn: "*",
      operation: "count",
    });
  });

  it("showPreview padrão (true) renderiza o CmReportPdfPreview com 20 linhas placeholder quando previewRows não é informado", () => {
    const view = makeView();
    renderEditor(view);

    expect(screen.getByTestId("preview-mock")).toBeInTheDocument();
    expect(h.previewSpy).toHaveBeenCalled();

    const previewProps = h.previewSpy.mock.calls[0][0] as CmReportPdfPreviewProps<Venda>;
    expect(previewProps.rows).toHaveLength(20);
    expect(previewProps.rows[0]).toEqual({
      data: new Date(2026, 0, 1),
      cliente: "Exemplo 1",
      total: 123.45,
    });
    expect(previewProps.definition).toBe(definition);
    expect(previewProps.view).toBe(view);
  });

  it("repassa previewRows ao CmReportPdfPreview em vez do placeholder, quando informado", () => {
    const customRows: Venda[] = [{ data: "2026-02-01", cliente: "Zeca", total: 10 }];
    const onViewChange = vi.fn();

    render(
      <CmReportLayoutEditor
        definition={definition}
        view={makeView()}
        onViewChange={onViewChange}
        previewRows={customRows}
      />,
    );

    const previewProps = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<Venda>;
    expect(previewProps.rows).toBe(customRows);
  });

  it("showPreview: false não renderiza o CmReportPdfPreview", () => {
    const onViewChange = vi.fn();

    render(
      <CmReportLayoutEditor
        definition={definition}
        view={makeView()}
        onViewChange={onViewChange}
        showPreview={false}
      />,
    );

    expect(screen.queryByTestId("preview-mock")).not.toBeInTheDocument();
    expect(h.previewSpy).not.toHaveBeenCalled();
  });

  it("aguarda a duplicação antes de confirmar e impede outro clique durante a operação", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onDuplicate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderEditor(makeView({ isSystem: true }), { onDuplicate });

    await user.click(screen.getByRole("button", { name: "Duplicar para editar" }));
    expect(screen.getByRole("button", { name: "Duplicar para editar" })).toBeDisabled();
    expect(screen.queryByText("Layout duplicado. A cópia está pronta para editar.")).toBeNull();

    await act(async () => finish());

    expect(
      screen
        .getByText("Layout duplicado. A cópia está pronta para editar.")
        .closest("[role=alert]"),
    ).toHaveClass("cm-toast__item--success");
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Duplicar para editar" })).toBeEnabled();
  });

  it("avisa falha de duplicação sem remover a ação contextual", async () => {
    const user = userEvent.setup();
    renderEditor(makeView({ isSystem: true }), {
      onDuplicate: async () => {
        throw new Error("Armazenamento indisponível");
      },
    });

    await user.click(screen.getByRole("button", { name: "Duplicar para editar" }));

    expect(screen.getByText("Armazenamento indisponível").closest("[role=alert]")).toHaveClass(
      "cm-toast__item--danger",
    );
    expect(screen.queryByText("Layout duplicado. A cópia está pronta para editar.")).toBeNull();
    expect(screen.getByRole("button", { name: "Duplicar para editar" })).toBeEnabled();
  });

  it("notifica erro de PDF sem recriar as linhas e reagendar a mesma pré-visualização", () => {
    renderEditor(makeView());
    const before = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<Venda>;

    act(() => before.onError?.(new Error("Falha na imagem do cabeçalho")));

    expect(screen.getByText("Falha na imagem do cabeçalho").closest("[role=alert]")).toHaveClass(
      "cm-toast__item--danger",
    );
    const after = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<Venda>;
    expect(after.rows).toBe(before.rows);
    expect(after.definition).toBe(before.definition);
    expect(after.view).toBe(before.view);
  });
});
