// computeSummary — calcula os itens de sumário (soma/contagem/média/mínimo/máximo) de um
// conjunto de linhas, usando o exportValue da coluna correspondente para extrair os valores.
import { formatValue, toNumber } from "./formatters.js";
import type {
  ReportCellValue,
  ReportComputedSummaryItem,
  ReportFormatOptions,
  ReportSummaryItem,
  ResolvedReportColumn,
} from "./types.js";

/** Lê o valor bruto de `sourceColumn` em cada linha: via `exportValue` quando a coluna existe
 *  no relatório, ou lendo `row[sourceColumn]` diretamente caso contrário. */
function extractRawValues<T>(
  rows: T[],
  sourceColumn: string,
  column?: ResolvedReportColumn<T>,
): ReportCellValue[] {
  return rows.map((row) =>
    column
      ? column.exportValue(row)
      : ((row as Record<string, unknown>)[sourceColumn] as ReportCellValue),
  );
}

/**
 * Calcula o valor numérico de um item (exceto o caso `sourceColumn: "*"`, tratado à parte).
 * `count` conta linhas com valor não-nulo (não exige que seja numérico); `sum`/`avg`/`min`/`max`
 * ignoram valores não numéricos. Operações sem valores numéricos resultam em 0.
 */
function computeOperationValue<T>(
  rows: T[],
  item: ReportSummaryItem,
  column: ResolvedReportColumn<T> | undefined,
): number {
  const rawValues = extractRawValues(rows, item.sourceColumn, column);

  if (item.operation === "count") {
    return rawValues.filter((value) => value !== null && value !== undefined).length;
  }

  const numbers = rawValues.map(toNumber).filter((n): n is number => n !== null);

  switch (item.operation) {
    case "sum":
      return numbers.reduce((sum, n) => sum + n, 0);
    case "avg":
      return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
    case "min":
      return numbers.length > 0 ? Math.min(...numbers) : 0;
    case "max":
      return numbers.length > 0 ? Math.max(...numbers) : 0;
    default:
      return 0;
  }
}

/**
 * Calcula os itens de sumário a partir de `rows`. `sourceColumn: "*"` sempre conta o número de
 * linhas, independente da operação pedida. Cada item é formatado com `formatValue`, usando o
 * `format` do próprio item, com fallback para o `format` da coluna correspondente e, por fim,
 * "number".
 */
export function computeSummary<T>(
  rows: T[],
  items: ReportSummaryItem[],
  columns: ResolvedReportColumn<T>[],
  options?: ReportFormatOptions,
): ReportComputedSummaryItem[] {
  const columnsByKey = new Map(columns.map((column) => [column.key, column]));

  return items.map((item) => {
    const column = item.sourceColumn === "*" ? undefined : columnsByKey.get(item.sourceColumn);
    const format = item.format ?? column?.format ?? "number";
    const value =
      item.sourceColumn === "*" ? rows.length : computeOperationValue(rows, item, column);

    return { label: item.label, value, formatted: formatValue(value, format, options) };
  });
}
