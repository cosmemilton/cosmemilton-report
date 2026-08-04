// map-columns — conversões numéricas puras usadas pelos primitivos do entry /pdf: milímetros
// (unidade das margens em `ReportGlobalConfig`) para pontos (unidade nativa do react-pdf) e
// largura percentual de coluna para o formato de string aceito pelo `style` do react-pdf.
import type { ReportPaperSize } from "../core/types.js";

/** 1mm = 72pt / 25.4mm. */
const PT_PER_MM = 2.834645669;

/** Converte milímetros em pontos PDF (`react-pdf` usa pontos como unidade base de `style`). */
export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/** Arredonda para 2 casas decimais — evita strings de largura como "33.333333333333336%". */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formata um percentual de largura de coluna (`ResolvedReportColumn.widthPct`) como string de
 *  largura do `style` do react-pdf (ex.: `widthPct(33.33333)` → `"33.33%"`). */
export function widthPct(pct: number): `${number}%` {
  return `${round2(pct)}%`;
}

/** Mapeia o `ReportPaperSize` do core para o valor de `<Page size>` aceito pelo react-pdf. */
export function paperSizeToReactPdf(paperSize: ReportPaperSize): "A4" | "LETTER" {
  return paperSize === "Letter" ? "LETTER" : "A4";
}
