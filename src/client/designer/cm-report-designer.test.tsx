"use client";

// `vitest.setup.ts` já importa "@testing-library/jest-dom/vitest" em runtime, mas esse arquivo
// fica fora do `include` do tsconfig — sem este import aqui, `tsc --noEmit` não vê a augmentação
// de tipos de `Assertion` (ver `cm-report-layout-editor.test.tsx`, mesmo padrão).
import "@testing-library/jest-dom/vitest";
import { useState, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render as renderComponent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { CmToastProvider } from "cosmemilton-ui/client";
import { parseReportDefinition } from "../../core/parse.js";
import { createMemoryReportAdapter } from "../../core/storage/memory-adapter.js";
import type { ReportDataSource, SerializableReportDefinition } from "../../core/types.js";
import type { CmReportPdfPreviewProps } from "../preview/cm-report-pdf-preview.js";
import { CmReportDesigner } from "./cm-report-designer.js";

// O preview real gera PDF de verdade (import dinâmico de @react-pdf/renderer) — fora do escopo
// deste arquivo. Mesmo mock usado em `cm-report-layout-editor.test.tsx`.
const h = vi.hoisted(() => ({ previewSpy: vi.fn() }));

vi.mock("../preview/cm-report-pdf-preview.js", () => ({
  CmReportPdfPreview: (props: CmReportPdfPreviewProps<unknown>) => {
    h.previewSpy(props);
    return <div data-testid="preview-mock" />;
  },
}));

afterEach(cleanup);

function render(ui: ReactElement) {
  return renderComponent(ui, { wrapper: CmToastProvider });
}

const dataSources: ReportDataSource[] = [
  {
    id: "vendas",
    name: "Vendas",
    fields: [
      { key: "data", label: "Data da Venda", format: "date" },
      { key: "cliente", label: "Cliente" },
      { key: "total", label: "Total", format: "currency" },
    ],
  },
];

/** Verifica recursivamente que nenhum valor do objeto é uma função — usado para confirmar que a
 *  definição salva é JSON puro (`SerializableReportDefinition`), sem `exportValue`/`pdfRender`. */
function hasNoFunctions(value: unknown): boolean {
  if (typeof value === "function") return false;
  if (Array.isArray(value)) return value.every(hasNoFunctions);
  if (value && typeof value === "object") return Object.values(value).every(hasNoFunctions);
  return true;
}

async function selectComboboxOption(
  user: UserEvent,
  comboboxName: string,
  optionName: string,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: comboboxName }));
  await user.click(screen.getByRole("option", { name: optionName }));
}

/** Cada campo da fonte tem seu próprio botão "Adicionar como coluna" — localizamos pelo
 *  container da linha (que tem o rótulo do campo) em vez de assumir um índice fixo. */
async function addColumn(user: UserEvent, fieldLabel: string): Promise<void> {
  const row = screen
    .getByText(fieldLabel, { selector: ".cm-report-designer__source-field-label" })
    .closest(".cm-report-designer__source-field");
  if (!row) throw new Error(`Linha do campo "${fieldLabel}" não encontrada`);
  const addButton = within(row as HTMLElement).getByRole("button", {
    name: /^Adicionar como coluna/,
  });
  await user.click(addButton);
}

describe("CmReportDesigner", () => {
  it("fluxo de criação: selecionar fonte, adicionar 2 colunas, digitar nome gera slug, e salvar chama adapter.saveDefinition com definição válida", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDefinition");
    const onSaved = vi.fn();

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} onSaved={onSaved} />);

    await selectComboboxOption(user, "Fonte de dados", "Vendas");
    await addColumn(user, "Data da Venda");
    await addColumn(user, "Cliente");

    // Colunas aparecem na aba Colunas (ativa por padrão) herdando o rótulo do campo.
    expect(screen.getByDisplayValue("Data da Venda")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cliente")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome do relatório"), "Vendas por Região");
    expect(screen.getByLabelText("Slug")).toHaveValue("vendas-por-regiao");

    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const saved = saveSpy.mock.calls[0][0] as SerializableReportDefinition;

    expect(saved.slug).toBe("vendas-por-regiao");
    expect(saved.name).toBe("Vendas por Região");
    expect(saved.columns.map((c) => c.key)).toEqual(["data", "cliente"]);
    expect(saved.columns[0]).toMatchObject({ header: "Data da Venda", format: "date" });
    expect(saved.columns[1]).toMatchObject({ header: "Cliente" });

    expect(parseReportDefinition(saved)).not.toBeNull();
    expect(hasNoFunctions(saved)).toBe(true);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0]).toEqual(parseReportDefinition(saved));
    expect(screen.getByText("Relatório salvo com sucesso.").closest("[role=alert]")).toHaveClass(
      "cm-toast__item--success",
    );
  });

  it("salvar sem nome mostra 'Informe o nome do relatório' e não chama o adapter", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDefinition");

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} />);

    await selectComboboxOption(user, "Fonte de dados", "Vendas");
    await addColumn(user, "Cliente");

    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));

    expect(screen.getByText("Informe o nome do relatório")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--warning");
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("salvar sem colunas mostra 'Adicione ao menos uma coluna' e não chama o adapter", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDefinition");

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} />);

    await user.type(screen.getByLabelText("Nome do relatório"), "Relatório Vazio");
    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));

    expect(screen.getByText("Adicione ao menos uma coluna")).toBeInTheDocument();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("modo edição: slug fica disabled e o salvamento mantém o slug original", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDefinition");

    const existing: SerializableReportDefinition = {
      slug: "clientes",
      name: "Relatório de Clientes",
      dataSource: "vendas",
      columns: [{ key: "cliente", header: "Cliente" }],
    };

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} definition={existing} />);

    const slugInput = screen.getByLabelText("Slug");
    expect(slugInput).toBeDisabled();
    expect(slugInput).toHaveValue("clientes");

    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const saved = saveSpy.mock.calls[0][0] as SerializableReportDefinition;
    expect(saved.slug).toBe("clientes");
  });

  it("agrupamento: escolher coluna + subtotal grava group na definição salva; 'Nenhum' remove", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const saveSpy = vi.spyOn(adapter, "saveDefinition");

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} />);

    await selectComboboxOption(user, "Fonte de dados", "Vendas");
    await addColumn(user, "Cliente");
    await user.type(screen.getByLabelText("Nome do relatório"), "Relatório Agrupado");

    await selectComboboxOption(user, "Agrupar por", "Cliente");
    expect(screen.getByRole("switch", { name: "Exibir subtotal" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const firstSave = saveSpy.mock.calls[0][0] as SerializableReportDefinition;
    expect(firstSave.group).toEqual({ by: "cliente", showSubtotal: true });

    await selectComboboxOption(user, "Agrupar por", "Nenhum");
    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(2));
    const secondSave = saveSpy.mock.calls[1][0] as SerializableReportDefinition;
    expect(secondSave.group).toBeUndefined();
  });

  it("sem fonte selecionada e sem colunas: abas ficam desabilitadas e o aviso é exibido", () => {
    const adapter = createMemoryReportAdapter();
    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} />);

    expect(screen.getByRole("tab", { name: "Colunas" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Cabeçalho" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Sumário" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Estilo" })).toBeDisabled();

    expect(
      screen.getAllByText("Selecione uma fonte de dados para começar").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("campo já adicionado como coluna: o botão some e o estado 'Coluna já adicionada' aparece", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} />);

    await selectComboboxOption(user, "Fonte de dados", "Vendas");
    await addColumn(user, "Cliente");

    const clienteRow = screen
      .getByText("Cliente", { selector: ".cm-report-designer__source-field-label" })
      .closest(".cm-report-designer__source-field");
    const totalRow = screen
      .getByText("Total", { selector: ".cm-report-designer__source-field-label" })
      .closest(".cm-report-designer__source-field");
    if (!clienteRow || !totalRow) throw new Error("linhas de campo não encontradas");

    // UI nova: o botão de adicionar é substituído pelo check "Coluna já adicionada".
    expect(
      within(clienteRow as HTMLElement).queryByRole("button", { name: /^Adicionar como coluna/ }),
    ).not.toBeInTheDocument();
    expect(
      within(totalRow as HTMLElement).getByRole("button", { name: /^Adicionar como coluna/ }),
    ).not.toBeDisabled();
    expect(within(clienteRow as HTMLElement).getByText("Coluna já adicionada")).toBeInTheDocument();
  });

  it("onSaved é chamado com a definição parseada e onCancel é chamado pelo botão Cancelar", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const onCancel = vi.fn();

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("preview: usa generatePlaceholderRows quando getPreviewRows não é informado", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();

    render(<CmReportDesigner dataSources={dataSources} adapter={adapter} />);

    await selectComboboxOption(user, "Fonte de dados", "Vendas");
    await addColumn(user, "Cliente");

    await waitFor(() => expect(h.previewSpy).toHaveBeenCalled());
    const lastCall = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<unknown>;
    expect(lastCall.rows).toHaveLength(20);
  });

  it("preview: usa getPreviewRows quando informado e uma fonte está selecionada", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    const sampleRows = [{ cliente: "Ana" }, { cliente: "Beto" }];
    const getPreviewRows = vi.fn(async () => sampleRows);

    render(
      <CmReportDesigner
        dataSources={dataSources}
        adapter={adapter}
        getPreviewRows={getPreviewRows}
      />,
    );

    await selectComboboxOption(user, "Fonte de dados", "Vendas");

    await waitFor(() => expect(getPreviewRows).toHaveBeenCalledWith(dataSources[0]));
    await waitFor(() => {
      const lastCall = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<unknown>;
      expect(lastCall.rows).toBe(sampleRows);
    });
  });

  it("usa o provider do app e mantém a confirmação quando onSaved fecha o designer", async () => {
    const user = userEvent.setup();
    const adapter = createMemoryReportAdapter();
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <CmToastProvider position="top-left">
          {open ? (
            <CmReportDesigner
              dataSources={dataSources}
              adapter={adapter}
              definition={{
                slug: "vendas",
                name: "Vendas",
                columns: [{ key: "cliente", header: "Cliente" }],
              }}
              onSaved={() => setOpen(false)}
            />
          ) : (
            <p>Lista de relatórios</p>
          )}
        </CmToastProvider>
      );
    }
    renderComponent(<Page />);

    await user.click(screen.getByRole("button", { name: "Salvar relatório" }));

    expect(screen.getByText("Lista de relatórios")).toBeInTheDocument();
    expect(
      screen.getByText("Relatório salvo com sucesso.").closest(".cm-toast__viewport"),
    ).toHaveAttribute("data-position", "top-left");
    expect(document.querySelectorAll(".cm-toast__viewport")).toHaveLength(1);
  });

  it.each([new Error("Quota excedida"), "falha desconhecida"])(
    "mostra falha de persistência via toast e não chama onSaved (%s)",
    async (failure) => {
      const user = userEvent.setup();
      const adapter = createMemoryReportAdapter();
      vi.spyOn(adapter, "saveDefinition").mockRejectedValue(failure);
      const onSaved = vi.fn();
      render(
        <CmReportDesigner
          dataSources={dataSources}
          adapter={adapter}
          definition={{
            slug: "vendas",
            name: "Vendas",
            columns: [{ key: "cliente", header: "Cliente" }],
          }}
          onSaved={onSaved}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Salvar relatório" }));

      expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--danger");
      expect(
        screen.getByText(
          failure instanceof Error ? failure.message : "Falha ao salvar o relatório.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Relatório salvo com sucesso.")).toBeNull();
      expect(onSaved).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Salvar relatório" })).toBeEnabled();
    },
  );

  it("avisa quando a amostra falha e identifica que o preview usa dados de exemplo", async () => {
    const adapter = createMemoryReportAdapter();
    const getPreviewRows = vi.fn().mockRejectedValue(new Error("Offline"));
    render(
      <CmReportDesigner
        dataSources={dataSources}
        adapter={adapter}
        definition={{
          slug: "vendas",
          name: "Vendas",
          dataSource: "vendas",
          columns: [{ key: "cliente", header: "Cliente" }],
        }}
        getPreviewRows={getPreviewRows}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a amostra. A pré-visualização usa dados de exemplo.",
    );
    expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--warning");
    const props = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<unknown>;
    expect(props.rows).toHaveLength(20);
    expect(getPreviewRows).toHaveBeenCalledTimes(1);
  });

  it("notifica falha do PDF sem mudar as entradas que agendam a geração", () => {
    render(<CmReportDesigner dataSources={dataSources} adapter={createMemoryReportAdapter()} />);
    const before = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<unknown>;

    act(() => before.onError?.(new Error("Imagem inválida")));

    expect(screen.getByRole("alert")).toHaveClass("cm-toast__item--danger");
    expect(screen.getByRole("alert")).toHaveTextContent("Imagem inválida");
    const after = h.previewSpy.mock.calls.at(-1)?.[0] as CmReportPdfPreviewProps<unknown>;
    expect(after.rows).toBe(before.rows);
    expect(after.definition).toBe(before.definition);
  });

  it("exige provider explícito em vez de descartar as notificações", () => {
    expect(() =>
      renderComponent(
        <CmReportDesigner dataSources={dataSources} adapter={createMemoryReportAdapter()} />,
      ),
    ).toThrow("useCmToast must be used within <CmToastProvider>");
  });
});
