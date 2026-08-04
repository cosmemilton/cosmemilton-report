"use client";

// SummaryTab — aba "Sumário" do editor: lista editável de `ReportSummaryItem`. A lista efetiva é
// `view.summary ?? definitionSummary ?? []` — mas qualquer edição (adicionar/remover/alterar
// item) reescreve a lista INTEIRA em `view.summary`, já que a view SUBSTITUI (não mescla) o
// summary da definição (ver `resolveReport`/plano, decisão de arquitetura).
import type { ReactElement } from "react";
import { CmButton, CmInput, CmSelect } from "cosmemilton-ui/client";
import { CmIcon } from "cosmemilton-ui/server";
import type { ReportSummaryItem, ReportSummaryOperation, ReportView } from "../../core/types.js";
import type { CmReportLayoutEditorLabels } from "./labels.js";

export type SummaryTabProps = {
  view: ReportView;
  onViewChange: (view: ReportView) => void;
  /** `definition.summary` — só o campo (ver `HeaderTab` para o mesmo raciocínio). */
  definitionSummary?: ReportSummaryItem[];
  /** Colunas da definição disponíveis como fonte do item (`key`/`header`, sem funções). */
  sourceColumns: { key: string; header: string }[];
  disabled: boolean;
  labels: CmReportLayoutEditorLabels;
};

const ROWS_SOURCE_COLUMN = "*";
const OPERATIONS: ReportSummaryOperation[] = ["sum", "count", "avg", "min", "max"];
const FORMATS: NonNullable<ReportSummaryItem["format"]>[] = [
  "text",
  "number",
  "integer",
  "currency",
  "percent",
  "date",
  "datetime",
];

function operationLabel(
  operation: ReportSummaryOperation,
  labels: CmReportLayoutEditorLabels,
): string {
  switch (operation) {
    case "sum":
      return labels.operationSum;
    case "count":
      return labels.operationCount;
    case "avg":
      return labels.operationAvg;
    case "min":
      return labels.operationMin;
    case "max":
      return labels.operationMax;
  }
}

function formatLabel(
  format: NonNullable<ReportSummaryItem["format"]>,
  labels: CmReportLayoutEditorLabels,
): string {
  switch (format) {
    case "text":
      return labels.formatText;
    case "number":
      return labels.formatNumber;
    case "integer":
      return labels.formatInteger;
    case "currency":
      return labels.formatCurrency;
    case "percent":
      return labels.formatPercent;
    case "date":
      return labels.formatDate;
    case "datetime":
      return labels.formatDatetime;
  }
}

export function SummaryTab(props: SummaryTabProps): ReactElement {
  const { view, onViewChange, definitionSummary, sourceColumns, disabled, labels } = props;
  const items: ReportSummaryItem[] = view.summary ?? definitionSummary ?? [];

  const sourceOptions = [
    { value: ROWS_SOURCE_COLUMN, label: labels.summaryRowsOption },
    ...sourceColumns.map((column) => ({ value: column.key, label: column.header })),
  ];
  const operationOptions = OPERATIONS.map((operation) => ({
    value: operation,
    label: operationLabel(operation, labels),
  }));
  const formatOptions = FORMATS.map((format) => ({
    value: format,
    label: formatLabel(format, labels),
  }));

  function emit(nextItems: ReportSummaryItem[]): void {
    onViewChange({ ...view, summary: nextItems });
  }

  function updateItem(index: number, patch: Partial<ReportSummaryItem>): void {
    emit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem(): void {
    emit([
      ...items,
      { label: labels.summaryNewItemLabel, sourceColumn: ROWS_SOURCE_COLUMN, operation: "count" },
    ]);
  }

  function removeItem(index: number): void {
    emit(items.filter((_, i) => i !== index));
  }

  return (
    <div className="cm-report-editor__summary-list">
      {items.length === 0 ? (
        <p className="cm-report-editor__summary-empty">{labels.summaryEmpty}</p>
      ) : null}

      {items.map((item, index) => (
        // Itens de sumário não têm id próprio; a lista só muda por add/remove/substituição
        // inteira (nunca reordenação in-place), então a key por índice é estável o bastante.
        <div key={index} className="cm-report-editor__summary-row">
          <div className="cm-report-editor__summary-label-field">
            <CmInput
              label={labels.summaryLabelField}
              placeholder={labels.summaryLabelPlaceholder}
              value={item.label}
              onChange={(event) => updateItem(index, { label: event.target.value })}
              disabled={disabled}
            />
          </div>
          <div className="cm-report-editor__summary-remove">
            <CmButton
              type="button"
              variant="ghost"
              tone="danger"
              size="sm"
              iconOnly
              icon={<CmIcon name="lucide:trash-2" size={16} />}
              aria-label={labels.summaryRemoveItem}
              title={labels.summaryRemoveItem}
              onClick={() => removeItem(index)}
              disabled={disabled}
            />
          </div>
          <div className="cm-report-editor__summary-details">
            <CmSelect
              label={labels.summarySourceColumn}
              value={item.sourceColumn}
              onChange={(value) => updateItem(index, { sourceColumn: value })}
              options={sourceOptions}
              disabled={disabled}
            />
            <CmSelect
              label={labels.summaryOperation}
              value={item.operation}
              onChange={(value) =>
                updateItem(index, { operation: value as ReportSummaryOperation })
              }
              options={operationOptions}
              disabled={disabled}
            />
            <CmSelect
              label={labels.summaryFormat}
              value={item.format ?? "number"}
              onChange={(value) =>
                updateItem(index, { format: value as ReportSummaryItem["format"] })
              }
              options={formatOptions}
              disabled={disabled}
            />
          </div>
        </div>
      ))}

      <CmButton
        type="button"
        variant="outline"
        icon={<CmIcon name="lucide:plus" size={16} />}
        onClick={addItem}
        disabled={disabled}
        className="cm-report-editor__summary-add"
      >
        {labels.summaryAddItem}
      </CmButton>
    </div>
  );
}
