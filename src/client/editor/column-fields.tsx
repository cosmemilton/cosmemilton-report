"use client";

// column-fields.tsx — subcomponentes de campo de coluna COMPARTILHÁVEIS entre o
// CmReportLayoutEditor (Fase 8, escreve `ReportViewColumn` — overrides) e o CmReportDesigner
// (Fase 10, escreve `SerializableReportColumn` — colunas completas da definição). Cada campo é
// totalmente controlado: recebe `value` + `onChange(patch)` + `disabled`, sem estado próprio, e
// emite só a chave que edita — quem chama decide como mesclar o patch (upsert de override aqui,
// merge direto na coluna lá).
import type { ReactElement } from "react";
import { CmInput, CmSelect } from "cosmemilton-ui/client";
import type { ReportColumnAlign, ReportFormat } from "../../core/types.js";

/** Rótulos usados pelos campos de coluna. Qualquer objeto com estas chaves serve — o
 *  `CmReportLayoutEditorLabels` as inclui todas, e um eventual `CmReportDesignerLabels`
 *  (Fase 10) pode fazer o mesmo sem depender deste módulo. */
export type ColumnFieldLabels = {
  columnHeaderLabel: string;
  columnWidthLabel: string;
  columnAlignLabel: string;
  columnFormatLabel: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  formatText: string;
  formatNumber: string;
  formatInteger: string;
  formatCurrency: string;
  formatPercent: string;
  formatDate: string;
  formatDatetime: string;
};

type AlignLabels = Pick<ColumnFieldLabels, "alignLeft" | "alignCenter" | "alignRight">;
type FormatLabels = Pick<
  ColumnFieldLabels,
  | "formatText"
  | "formatNumber"
  | "formatInteger"
  | "formatCurrency"
  | "formatPercent"
  | "formatDate"
  | "formatDatetime"
>;

const ALIGN_VALUES: ReportColumnAlign[] = ["left", "center", "right"];
const FORMAT_VALUES: ReportFormat[] = [
  "text",
  "number",
  "integer",
  "currency",
  "percent",
  "date",
  "datetime",
];

function alignLabel(align: ReportColumnAlign, labels: AlignLabels): string {
  switch (align) {
    case "left":
      return labels.alignLeft;
    case "center":
      return labels.alignCenter;
    case "right":
      return labels.alignRight;
  }
}

function formatLabel(format: ReportFormat, labels: FormatLabels): string {
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

export type ColumnHeaderFieldProps = {
  value: string;
  onChange: (patch: { header: string }) => void;
  disabled?: boolean;
  labels: Pick<ColumnFieldLabels, "columnHeaderLabel">;
};

export function ColumnHeaderField({
  value,
  onChange,
  disabled,
  labels,
}: ColumnHeaderFieldProps): ReactElement {
  return (
    <CmInput
      label={labels.columnHeaderLabel}
      value={value}
      onChange={(event) => onChange({ header: event.target.value })}
      disabled={disabled}
      className="cm-report-editor__column-field"
    />
  );
}

export type ColumnWidthFieldProps = {
  /** `undefined` = sem largura explícita (a coluna herda a distribuição automática). */
  value: `${number}%` | undefined;
  onChange: (patch: { width: `${number}%` }) => void;
  disabled?: boolean;
  labels: Pick<ColumnFieldLabels, "columnWidthLabel">;
};

/** `CmInput inputMode="numeric"` já sanitiza a digitação para dígitos (ver `resolveNumericMode`
 *  em cosmemilton-ui/input) — só convertemos o número puro digitado para `"NN%"` no patch. */
export function ColumnWidthField({
  value,
  onChange,
  disabled,
  labels,
}: ColumnWidthFieldProps): ReactElement {
  const numericValue = value ? String(Number.parseFloat(value)) : "";

  return (
    <CmInput
      label={labels.columnWidthLabel}
      inputMode="numeric"
      value={numericValue}
      onChange={(event) => {
        const parsed = Number.parseFloat(event.target.value);
        if (Number.isFinite(parsed)) {
          onChange({ width: `${parsed}%` });
        }
      }}
      disabled={disabled}
      className="cm-report-editor__column-field cm-report-editor__column-field--width"
    />
  );
}

export type ColumnAlignFieldProps = {
  value: ReportColumnAlign;
  onChange: (patch: { align: ReportColumnAlign }) => void;
  disabled?: boolean;
  labels: Pick<ColumnFieldLabels, "columnAlignLabel"> & AlignLabels;
};

export function ColumnAlignField({
  value,
  onChange,
  disabled,
  labels,
}: ColumnAlignFieldProps): ReactElement {
  const options = ALIGN_VALUES.map((align) => ({ value: align, label: alignLabel(align, labels) }));

  return (
    <CmSelect
      label={labels.columnAlignLabel}
      value={value}
      onChange={(next) => onChange({ align: next as ReportColumnAlign })}
      options={options}
      disabled={disabled}
      className="cm-report-editor__column-field"
    />
  );
}

export type ColumnFormatFieldProps = {
  value: ReportFormat;
  onChange: (patch: { format: ReportFormat }) => void;
  disabled?: boolean;
  labels: Pick<ColumnFieldLabels, "columnFormatLabel"> & FormatLabels;
};

export function ColumnFormatField({
  value,
  onChange,
  disabled,
  labels,
}: ColumnFormatFieldProps): ReactElement {
  const options = FORMAT_VALUES.map((format) => ({
    value: format,
    label: formatLabel(format, labels),
  }));

  return (
    <CmSelect
      label={labels.columnFormatLabel}
      value={value}
      onChange={(next) => onChange({ format: next as ReportFormat })}
      options={options}
      disabled={disabled}
      className="cm-report-editor__column-field"
    />
  );
}
