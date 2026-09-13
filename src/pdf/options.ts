/** Opções de renderização PDF; não alteram dados, filtros ou configuração persistida. */
export type ReportPdfOptions = {
  /**
   * APIs servidor: auto usa PDFKit em Node 20+ para tabelas/sections suportadas,
   * com fallback React para os demais relatórios. react-pdf força o renderer React.
   * createReportDocument sempre retorna a árvore React, independentemente desta opção.
   */
  engine?: "auto" | "react-pdf";
  /**
   * Limita as linhas de dados por bloco de paginação em A4/Letter. Padrão: 100.
   * Cada bloco começa em uma página e pode ocupar várias, conforme a altura real das
   * linhas. Pode haver espaço livre no fim do bloco. `false` mantém a paginação
   * contínua, com maior custo para tabelas longas. Bobinas nunca são divididas em blocos.
   * Seções/células com fixed, render dinâmico, destinos internos ou componentes React
   * opacos também mantêm o fluxo contínuo para preservar seu contexto de documento.
   */
  maxRowsPerBlock?: number | false;
};

const DEFAULT_MAX_ROWS_PER_BLOCK = 100;

export function resolveMaxRowsPerBlock(options?: ReportPdfOptions): number | false {
  if (
    options?.engine !== undefined &&
    options.engine !== "auto" &&
    options.engine !== "react-pdf"
  ) {
    throw new RangeError("engine deve ser auto ou react-pdf");
  }
  const limit = options?.maxRowsPerBlock;
  if (limit === undefined) return DEFAULT_MAX_ROWS_PER_BLOCK;
  if (limit === false) return false;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("maxRowsPerBlock deve ser um inteiro positivo ou false");
  }
  return limit;
}
