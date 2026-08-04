// datasetToCsv — serializa um ReportDataset em CSV pt-BR: delimitador ";" e BOM UTF-8 por
// default (Excel pt-BR reconhece acentos e abre em colunas sem assistente de importação).
// CSV é dado tabular puro: só header + rows — grupos/subtotais/summary ficam de fora.
import type { ReportDataset } from "../types.js";

export type CsvOptions = {
  delimiter?: string;
  includeBom?: boolean;
  lineBreak?: "\r\n" | "\n";
};

/** Marca de ordem de bytes UTF-8 (BOM), usada por Excel pt-BR para detectar o encoding. */
const BOM = "﻿";

/** Escapa um campo envolvendo-o em aspas quando contém o delimitador, aspas ou quebra de
 *  linha — duplicando aspas internas, como manda o formato CSV. */
function escapeField(value: string, delimiter: string): string {
  const needsQuoting =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  if (!needsQuoting) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Serializa `dataset` em CSV: uma linha de cabeçalho (`column.header`) seguida das linhas de
 * dados (`cell.formatted`). Default: delimitador ";", BOM UTF-8 incluído, quebra de linha
 * "\r\n". Não inclui grupos, subtotais nem sumário.
 */
export function datasetToCsv(dataset: ReportDataset, options?: CsvOptions): string {
  const delimiter = options?.delimiter ?? ";";
  const includeBom = options?.includeBom ?? true;
  const lineBreak = options?.lineBreak ?? "\r\n";

  const headerLine = dataset.columns
    .map((column) => escapeField(column.header, delimiter))
    .join(delimiter);

  const rowLines = dataset.rows.map((row) =>
    row.cells.map((cell) => escapeField(cell.formatted, delimiter)).join(delimiter),
  );

  const body = [headerLine, ...rowLines].join(lineBreak);

  return (includeBom ? BOM : "") + body;
}
