"use client";

// CmReportLayoutEditor — editor visual da `ReportView` de um relatório: 4 abas (Colunas,
// Cabeçalho, Sumário, Estilo) + preview ao vivo (`CmReportPdfPreview`, Fase 9). Toda mutação sai
// por `onViewChange` como overrides serializáveis — o editor nunca modifica a `ReportDefinition`.
// Quando `view.isSystem` (view somente leitura, nascida do registry via `createSystemView`) ou
// `readOnly`, todos os controles ficam desabilitados e um aviso oferece duplicar a view para uma
// cópia editável.
import type { ReactElement } from "react";
import {
  CmAlert,
  CmButton,
  CmTabs,
  CmTabsContent,
  CmTabsList,
  CmTabsTrigger,
} from "cosmemilton-ui/client";
import { generatePlaceholderRows } from "../../core/placeholder.js";
import type { ReportDefinition, ReportGlobalConfig, ReportView } from "../../core/types.js";
import { CmReportPdfPreview } from "../preview/cm-report-pdf-preview.js";
import { ColumnsTab } from "./columns-tab.js";
import { HeaderTab } from "./header-tab.js";
import { defaultReportLayoutEditorLabels, type CmReportLayoutEditorLabels } from "./labels.js";
import { StyleTab } from "./style-tab.js";
import { SummaryTab } from "./summary-tab.js";

export type CmReportLayoutEditorProps<T> = {
  definition: ReportDefinition<T>;
  /** View controlada — todo estado do editor vive no componente pai, via `onViewChange`. */
  view: ReportView;
  onViewChange: (view: ReportView) => void;
  globalConfig?: Partial<ReportGlobalConfig>;
  /** Linhas de amostra para a pré-visualização; sem elas, usa 20 linhas placeholder geradas a
   *  partir dos formatos das colunas da definição (`generatePlaceholderRows`). */
  previewRows?: T[];
  /** @default true — `false` remove a coluna de preview e o formulário ocupa toda a largura. */
  showPreview?: boolean;
  /** Repassado como `debounceMs` para o `CmReportPdfPreview`. @default 600 (default do preview) */
  previewDebounceMs?: number;
  /** Força os mesmos controles desabilitados de uma view `isSystem`, mesmo que não seja uma. */
  readOnly?: boolean;
  /** Botão "Duplicar para editar" só aparece quando `view.isSystem` E este callback é passado. */
  onDuplicate?: () => void;
  className?: string;
  labels?: Partial<CmReportLayoutEditorLabels>;
};

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function CmReportLayoutEditor<T>(props: CmReportLayoutEditorProps<T>): ReactElement {
  const {
    definition,
    view,
    onViewChange,
    globalConfig,
    previewRows,
    showPreview = true,
    previewDebounceMs,
    readOnly = false,
    onDuplicate,
    className,
    labels,
  } = props;

  const mergedLabels: CmReportLayoutEditorLabels = {
    ...defaultReportLayoutEditorLabels,
    ...labels,
  };

  const disabled = Boolean(view.isSystem || readOnly);
  const showDuplicateButton = Boolean(view.isSystem && onDuplicate);
  // Sem `previewRows`, gera 20 linhas de amostra a partir do `format` de cada coluna da
  // definição — mesmo formato de amostra que o `CmReportDesigner` usará (Fase 10). As linhas
  // placeholder não são estruturalmente `T`, mas têm as mesmas chaves usadas por
  // `column.exportValue`/`pdfRender` default (`row[key]`), suficiente para a pré-visualização.
  const placeholderRows = generatePlaceholderRows(
    definition.columns.map((column) => ({ key: column.key, format: column.format })),
    20,
  ) as unknown as T[];
  const sourceColumns = definition.columns.map((column) => ({
    key: column.key,
    header: column.header,
  }));

  return (
    <div
      className={joinClassNames(
        "cm-report-editor",
        !showPreview && "cm-report-editor--no-preview",
        className,
      )}
    >
      {disabled ? (
        <CmAlert
          tone="warning"
          title={mergedLabels.systemViewNotice}
          className="cm-report-editor__notice"
          action={
            showDuplicateButton ? (
              <CmButton type="button" variant="outline" onClick={onDuplicate}>
                {mergedLabels.duplicateButton}
              </CmButton>
            ) : undefined
          }
        />
      ) : null}

      <div className="cm-report-editor__body">
        <div className="cm-report-editor__form">
          <CmTabs defaultValue="columns">
            <CmTabsList>
              <CmTabsTrigger value="columns">{mergedLabels.tabColumns}</CmTabsTrigger>
              <CmTabsTrigger value="header">{mergedLabels.tabHeader}</CmTabsTrigger>
              <CmTabsTrigger value="summary">{mergedLabels.tabSummary}</CmTabsTrigger>
              <CmTabsTrigger value="style">{mergedLabels.tabStyle}</CmTabsTrigger>
            </CmTabsList>

            <CmTabsContent value="columns">
              <ColumnsTab
                definition={definition}
                view={view}
                onViewChange={onViewChange}
                disabled={disabled}
                labels={mergedLabels}
              />
            </CmTabsContent>

            <CmTabsContent value="header">
              <HeaderTab
                view={view}
                onViewChange={onViewChange}
                definitionHeader={definition.header}
                globalConfig={globalConfig}
                disabled={disabled}
                labels={mergedLabels}
              />
            </CmTabsContent>

            <CmTabsContent value="summary">
              <SummaryTab
                view={view}
                onViewChange={onViewChange}
                definitionSummary={definition.summary}
                sourceColumns={sourceColumns}
                disabled={disabled}
                labels={mergedLabels}
              />
            </CmTabsContent>

            <CmTabsContent value="style">
              <StyleTab
                view={view}
                onViewChange={onViewChange}
                definitionStyle={definition.style}
                globalConfig={globalConfig}
                disabled={disabled}
                labels={mergedLabels}
              />
            </CmTabsContent>
          </CmTabs>
        </div>

        {showPreview ? (
          <div className="cm-report-editor__preview">
            <CmReportPdfPreview
              definition={definition}
              rows={previewRows ?? placeholderRows}
              view={view}
              globalConfig={globalConfig}
              debounceMs={previewDebounceMs}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
