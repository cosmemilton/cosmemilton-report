// datasetToTsv — serializa um ReportDataset em TSV: separador tab, sem BOM, quebra de linha
// "\n". TSV não escapa aspas (diferente do CSV) — apenas remove tab/quebra de linha internos
// do próprio campo, substituindo-os por espaço, para não quebrar o alinhamento de colunas.
import type { ReportDataset } from "../types.js";

/** Remove tab/quebra de linha internos de um campo, substituindo-os por um único espaço. */
function sanitizeField(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ");
}

/**
 * Serializa `dataset` em TSV: uma linha de cabeçalho (`column.header`) seguida das linhas de
 * dados (`cell.formatted`), separadas por tab. Sem BOM. Não inclui grupos, subtotais nem
 * sumário — mesma regra do CSV: dado tabular puro.
 */
export function datasetToTsv(dataset: ReportDataset): string {
  const headerLine = dataset.columns.map((column) => sanitizeField(column.header)).join("\t");

  const rowLines = dataset.rows.map((row) =>
    row.cells.map((cell) => sanitizeField(cell.formatted)).join("\t"),
  );

  return [headerLine, ...rowLines].join("\n");
}
