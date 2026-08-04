"use client";

// Exemplo 04 — página de edição de layout persistida em localStorage: um seletor (`CmSelect`)
// entre a view do sistema e as cópias do usuário, um botão para duplicar a view ativa e outro
// para marcá-la como padrão. `useReportViews` provisiona a view do sistema no mount
// (`ensureReportViews`) e expõe as mutações; `CmReportLayoutEditor` só emite overrides
// serializáveis por `onViewChange` — nunca modifica `relatorioVendas`.
import { useMemo, type ReactElement } from "react";
import {
  createLocalStorageReportAdapter,
  type ReportDefinition,
  type ReportView,
} from "cosmemilton-report";
import { CmReportLayoutEditor, useReportViews } from "cosmemilton-report/client";
import { CmButton, CmSelect } from "cosmemilton-ui/client";
import { relatorioVendas } from "./01-minimo.js";

// Factory pura — `options.storage` só é acessado dentro dos métodos do adapter, então é seguro
// criá-lo aqui mesmo que o módulo seja avaliado durante SSR.
const adapter = createLocalStorageReportAdapter();

export function EditorLayoutVendas(): ReactElement {
  const { views, selectedView, selectView, duplicateView, saveView, setDefault, isLoading } =
    useReportViews({
      slug: relatorioVendas.slug,
      // `useReportViews` só lê `slug`/`columns` da definição (nunca chama `exportValue`/
      // `pdfRender`) — o cast é seguro; `CmReportLayoutEditor` abaixo continua recebendo
      // `relatorioVendas` com seu tipo `ReportDefinition<Venda>` original.
      definition: relatorioVendas as unknown as ReportDefinition<unknown>,
      adapter,
    });

  const viewOptions = useMemo(
    () => views.map((view) => ({ value: view.id, label: view.name })),
    [views],
  );

  if (isLoading || !selectedView) {
    return <p>Carregando layouts…</p>;
  }

  // Const própria (não o `selectedView` desestruturado) para que o TypeScript mantenha o tipo
  // não-nulo dentro dos handlers abaixo, sem precisar de `!` a cada uso.
  const view = selectedView;

  async function handleDuplicate(): Promise<void> {
    const copy = await duplicateView(view.id);
    selectView(copy.id);
  }

  function handleViewChange(next: ReportView): void {
    void saveView(next);
  }

  return (
    <div className="editor-layout-vendas">
      <div className="editor-layout-vendas__toolbar">
        <CmSelect label="Layout" value={view.id} onChange={selectView} options={viewOptions} />
        <CmButton type="button" variant="outline" onClick={() => void setDefault(view.id)}>
          Definir como padrão
        </CmButton>
      </div>

      <CmReportLayoutEditor
        definition={relatorioVendas}
        view={view}
        onViewChange={handleViewChange}
        onDuplicate={view.isSystem ? handleDuplicate : undefined}
      />
    </div>
  );
}
