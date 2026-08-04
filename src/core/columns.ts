// Resolução e normalização de colunas: merge definição+view e distribuição de larguras.
import type {
  ReportCellValue,
  ReportColumn,
  ReportFormat,
  ReportViewColumn,
  ResolvedReportColumn,
} from "./types.js";

const NUMERIC_FORMATS = new Set<ReportFormat>(["number", "integer", "currency", "percent"]);

/**
 * Mescla as colunas da definição (código) com os overrides serializáveis da view, casando por
 * `key`. Entradas da view cujo `key` não existe na definição são simplesmente ignoradas (não
 * criam colunas novas). Aplica os defaults: `align` "right" para formatos numéricos e "left"
 * para os demais; `visible`/`hideable` true; `noTotal` false; `exportValue` lê `row[key]`.
 *
 * A `widthPct` retornada aqui ainda não está normalizada — colunas sem `width` explícita saem
 * com `widthPct: 0`, um marcador interno resolvido por `normalizeColumnWidths`.
 */
export function resolveColumns<T>(
  columns: ReportColumn<T>[],
  viewColumns?: ReportViewColumn[],
): ResolvedReportColumn<T>[] {
  const viewByKey = new Map((viewColumns ?? []).map((viewColumn) => [viewColumn.key, viewColumn]));

  return columns.map((column, index) => {
    const key = column.key as string;
    const view = viewByKey.get(key);

    const format: ReportFormat = view?.format ?? column.format ?? "text";
    const width = view?.width ?? column.width;
    const widthPct = width ? Number.parseFloat(width) : 0;

    return {
      key,
      header: view?.header ?? column.header,
      widthPct,
      align: view?.align ?? column.align ?? (NUMERIC_FORMATS.has(format) ? "right" : "left"),
      format,
      visible: view?.visible ?? column.visible ?? true,
      hideable: column.hideable ?? true,
      sortOrder: view?.sortOrder ?? column.sortOrder ?? index,
      noTotal: column.noTotal ?? false,
      exportValue:
        column.exportValue ??
        ((row: T) => (row as Record<string, unknown>)[key] as ReportCellValue),
      pdfRender: column.pdfRender,
    };
  });
}

/**
 * Filtra apenas colunas visíveis, ordena por `sortOrder` e re-normaliza as larguras para somar
 * 100. Colunas sem largura definida (marcadas com `widthPct: 0` por `resolveColumns`) recebem
 * `(100 - somaDefinidas) / qtdSemWidth`, com mínimo de 1, antes da normalização final.
 */
export function normalizeColumnWidths<T>(
  columns: ResolvedReportColumn<T>[],
): ResolvedReportColumn<T>[] {
  const visible = columns
    .filter((column) => column.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (visible.length === 0) {
    return [];
  }

  const withoutWidth = visible.filter((column) => column.widthPct <= 0);
  const definedSum = visible.reduce(
    (sum, column) => sum + (column.widthPct > 0 ? column.widthPct : 0),
    0,
  );

  let widened = visible;
  if (withoutWidth.length > 0) {
    const remaining = Math.max(0, 100 - definedSum);
    const share = Math.max(1, remaining / withoutWidth.length);
    widened = visible.map((column) =>
      column.widthPct > 0 ? column : { ...column, widthPct: share },
    );
  }

  const total = widened.reduce((sum, column) => sum + column.widthPct, 0);
  if (total <= 0) {
    return widened;
  }

  return widened.map((column) => ({ ...column, widthPct: (column.widthPct / total) * 100 }));
}
