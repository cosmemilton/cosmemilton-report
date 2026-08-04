// generatePlaceholderRows — linhas de amostra por formato de coluna, usadas no preview do
// editor/designer quando não há dados reais disponíveis. Determinístico (sem Math.random):
// os valores são derivados apenas do índice da linha, então a mesma chamada sempre repete.
import type { ReportCellValue, ReportFormat } from "./types.js";

/** Valor de amostra para uma coluna de `format` dado, na linha de índice `index` (0-based). */
function placeholderValue(format: ReportFormat | undefined, index: number): ReportCellValue {
  switch (format) {
    case "number":
    case "currency":
      return (index + 1) * 123.45;
    case "integer":
      return index + 1;
    case "percent":
      return (index % 10) / 10;
    case "date":
    case "datetime":
      return new Date(2026, 0, 1 + index);
    case "text":
    default:
      return `Exemplo ${index + 1}`;
  }
}

/**
 * Gera `count` (default 20) linhas de amostra para `columns`, uma propriedade por `key`. O
 * valor de cada célula depende só do `format` da coluna e do índice da linha — chamadas
 * repetidas com os mesmos argumentos sempre retornam os mesmos valores.
 */
export function generatePlaceholderRows(
  columns: { key: string; format?: ReportFormat }[],
  count = 20,
): Record<string, ReportCellValue>[] {
  return Array.from({ length: count }, (_, index) => {
    const row: Record<string, ReportCellValue> = {};
    for (const column of columns) {
      row[column.key] = placeholderValue(column.format, index);
    }
    return row;
  });
}
