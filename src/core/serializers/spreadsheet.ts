import type { ReportCellValue } from "../types.js";

/** Mantém textos como dados ao abrir CSV/TSV em planilhas, inclusive após espaços/controles.
 *  Valores numéricos reais continuam numéricos (ex.: -12,50); cabeçalhos não têm valor bruto. */
export function escapeSpreadsheetFormula(value: string, raw?: ReportCellValue): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return value;
  }
  return /^\s*[=+@-]/u.test(value) ? `'${value}` : value;
}
