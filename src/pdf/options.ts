/** Opções de renderização PDF; não alteram dados, filtros ou configuração persistida. */
export type ReportPdfOptions<T = unknown> = {
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
  /**
   * Inicia uma nova página antes da linha indicada, mantendo a numeração global.
   * Avaliado uma vez por linha, na ordem visual, com o índice global e a referência
   * original. A primeira linha nunca gera uma página vazia. As quebras explícitas
   * também funcionam com maxRowsPerBlock:false ou conteúdo React contínuo.
   * Requer A4/Letter; bobinas rejeitam esta opção para preservar a altura automática.
   * Callback confiável da aplicação: não pertence à configuração serializável.
   * Sem colunas visíveis, não é executado e não cria páginas para dados ocultos.
   */
  breakBeforeRow?: (row: T, index: number) => boolean;
};

const DEFAULT_MAX_ROWS_PER_BLOCK = 100;

export function resolveMaxRowsPerBlock<T>(options?: ReportPdfOptions<T>): number | false {
  if (options?.breakBeforeRow !== undefined && typeof options.breakBeforeRow !== "function") {
    throw new TypeError("breakBeforeRow deve ser uma função");
  }
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
