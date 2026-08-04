// buildReportDataset — transforma linhas (T[]) num ReportDataset: células {raw, formatted},
// grupos com subtotal, total geral e sumário. Único ponto de entrada consumido por todos os
// serializers (CSV/TSV/JSON/XLSX).
import { formatValue, toNumber } from "./formatters.js";
import { groupRows } from "./groups.js";
import { computeSummary } from "./summary.js";
import type {
  ReportDataset,
  ReportDatasetCell,
  ReportDatasetGroup,
  ReportDatasetRow,
  ReportFormat,
  ReportFormatOptions,
  ResolvedReport,
  ResolvedReportColumn,
} from "./types.js";

const NUMERIC_FORMATS = new Set<ReportFormat>(["number", "integer", "currency", "percent"]);

/** Colunas elegíveis para subtotal/total: formato numérico e sem `noTotal`. */
function isTotalable<T>(column: ResolvedReportColumn<T>): boolean {
  return NUMERIC_FORMATS.has(column.format) && !column.noTotal;
}

function buildCell<T>(
  row: T,
  column: ResolvedReportColumn<T>,
  formatOptions: ReportFormatOptions,
): ReportDatasetCell {
  const raw = column.exportValue(row);
  return { raw, formatted: formatValue(raw, column.format, formatOptions) };
}

function buildRow<T>(
  row: T,
  columns: ResolvedReportColumn<T>[],
  formatOptions: ReportFormatOptions,
): ReportDatasetRow {
  return { cells: columns.map((column) => buildCell(row, column, formatOptions)) };
}

/** Soma (`sum`) os valores numéricos de `rows` por coluna — `null` nas colunas não elegíveis
 *  para total (não numéricas ou com `noTotal`), alinhado posicionalmente a `columns`. */
function computeAggregateRow<T>(
  rows: T[],
  columns: ResolvedReportColumn<T>[],
  formatOptions: ReportFormatOptions,
): (ReportDatasetCell | null)[] {
  return columns.map((column) => {
    if (!isTotalable(column)) {
      return null;
    }
    const sum = rows.reduce((acc, row) => {
      const n = toNumber(column.exportValue(row));
      return n === null ? acc : acc + n;
    }, 0);
    return { raw: sum, formatted: formatValue(sum, column.format, formatOptions) };
  });
}

/**
 * Constrói o `ReportDataset` a partir de `resolved` (já mesclado por `resolveReport`) e das
 * linhas de dados. Usa só `resolved.visibleColumns`. Quando `resolved.group` existe, monta
 * `groups` (com `subtotal` por grupo quando `group.showSubtotal !== false`) e ainda preenche
 * `rows` com todas as linhas, na ordem dos grupos. `total` só aparece quando existe ao menos
 * uma coluna numérica sem `noTotal` entre as visíveis.
 */
export function buildReportDataset<T>(
  resolved: ResolvedReport<T>,
  rows: T[],
  meta?: { userName?: string; generatedAt?: Date },
): ReportDataset {
  const columns = resolved.visibleColumns;
  const formatOptions = resolved.formatOptions;

  let datasetRows: ReportDatasetRow[];
  let groups: ReportDatasetGroup[] | undefined;

  if (resolved.group) {
    const rawGroups = groupRows(rows, resolved.group);
    const showSubtotal = resolved.group.showSubtotal !== false;

    groups = rawGroups.map((group) => {
      const groupRowsBuilt = group.rows.map((row) => buildRow(row, columns, formatOptions));
      const datasetGroup: ReportDatasetGroup = {
        key: group.key,
        label: group.label,
        rows: groupRowsBuilt,
      };
      if (showSubtotal) {
        datasetGroup.subtotal = computeAggregateRow(group.rows, columns, formatOptions);
      }
      return datasetGroup;
    });

    datasetRows = rawGroups.flatMap((group) =>
      group.rows.map((row) => buildRow(row, columns, formatOptions)),
    );
  } else {
    datasetRows = rows.map((row) => buildRow(row, columns, formatOptions));
  }

  const total = columns.some(isTotalable)
    ? computeAggregateRow(rows, columns, formatOptions)
    : undefined;

  const summary = computeSummary(rows, resolved.summary, resolved.columns, formatOptions);

  return {
    columns: columns.map((column) => ({
      key: column.key,
      header: column.header,
      align: column.align,
      format: column.format,
      widthPct: column.widthPct,
      noTotal: column.noTotal,
    })),
    rows: datasetRows,
    groups,
    total,
    summary,
    meta: {
      title: resolved.title,
      subtitle: resolved.subtitle,
      generatedAt: meta?.generatedAt ?? new Date(),
      userName: meta?.userName,
    },
  };
}
