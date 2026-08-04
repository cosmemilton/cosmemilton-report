"use client";

// Rótulos pt-BR do CmReportLayoutEditor. `labels?: Partial<CmReportLayoutEditorLabels>` nas
// props do editor é mesclado por cima destes defaults — quem só quer trocar um rótulo não
// precisa reescrever os demais.
//
// Este tipo também cobre as chaves consumidas por `column-fields.tsx` (campos de coluna
// compartilhados com o CmReportDesigner na Fase 10) — qualquer objeto de labels com essas
// chaves serve para os subcomponentes de coluna, mesmo vindo de um `CmReportDesignerLabels`
// futuro que não reexporte este tipo.
export type CmReportLayoutEditorLabels = {
  // Abas
  tabColumns: string;
  tabHeader: string;
  tabSummary: string;
  tabStyle: string;

  // Aviso de view do sistema (isSystem || readOnly)
  systemViewNotice: string;
  duplicateButton: string;

  // Aba Colunas
  showColumn: string;
  moveUp: string;
  moveDown: string;

  // Campos de coluna (compartilhados com column-fields.tsx)
  columnHeaderLabel: string;
  columnWidthLabel: string;
  columnAlignLabel: string;
  columnFormatLabel: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  formatText: string;
  formatNumber: string;
  formatInteger: string;
  formatCurrency: string;
  formatPercent: string;
  formatDate: string;
  formatDatetime: string;

  // Aba Cabeçalho
  headerTitle: string;
  headerSubtitle: string;
  headerTitlePlaceholder: string;
  headerSubtitlePlaceholder: string;
  headerShowLogo: string;
  headerShowCompanyName: string;
  headerShowGeneratedAt: string;
  headerShowUserName: string;
  headerShowPageNumbers: string;

  // Aba Sumário
  summaryEmpty: string;
  summaryLabelField: string;
  summaryLabelPlaceholder: string;
  summarySourceColumn: string;
  summaryRowsOption: string;
  summaryOperation: string;
  summaryFormat: string;
  operationSum: string;
  operationCount: string;
  operationAvg: string;
  operationMin: string;
  operationMax: string;
  summaryAddItem: string;
  summaryRemoveItem: string;
  summaryNewItemLabel: string;

  // Aba Estilo
  styleFontSize: string;
  styleHeaderFontSize: string;
  styleZebraStripes: string;
  styleShowGridLines: string;
  styleDensity: string;
  styleAccentColor: string;
  densityCompact: string;
  densityNormal: string;
  densityRelaxed: string;
};

export const defaultReportLayoutEditorLabels: CmReportLayoutEditorLabels = {
  tabColumns: "Colunas",
  tabHeader: "Cabeçalho",
  tabSummary: "Sumário",
  tabStyle: "Estilo",

  systemViewNotice: "Visão do sistema — duplique para editar",
  duplicateButton: "Duplicar para editar",

  showColumn: "Exibir coluna",
  moveUp: "Mover para cima",
  moveDown: "Mover para baixo",

  columnHeaderLabel: "Rótulo",
  columnWidthLabel: "Largura (%)",
  columnAlignLabel: "Alinhamento",
  columnFormatLabel: "Formato",
  alignLeft: "Esquerda",
  alignCenter: "Centro",
  alignRight: "Direita",
  formatText: "Texto",
  formatNumber: "Número",
  formatInteger: "Inteiro",
  formatCurrency: "Moeda",
  formatPercent: "Percentual",
  formatDate: "Data",
  formatDatetime: "Data e hora",

  headerTitle: "Título",
  headerSubtitle: "Subtítulo",
  headerTitlePlaceholder: "Título do relatório",
  headerSubtitlePlaceholder: "Subtítulo (opcional)",
  headerShowLogo: "Exibir logotipo",
  headerShowCompanyName: "Exibir nome da empresa",
  headerShowGeneratedAt: "Exibir data de geração",
  headerShowUserName: "Exibir nome do usuário",
  headerShowPageNumbers: "Exibir número de páginas",

  summaryEmpty: "Nenhum item de sumário — adicione um abaixo.",
  summaryLabelField: "Rótulo",
  summaryLabelPlaceholder: "Ex.: Total geral",
  summarySourceColumn: "Coluna de origem",
  summaryRowsOption: "Linhas (*)",
  summaryOperation: "Operação",
  summaryFormat: "Formato",
  operationSum: "Soma",
  operationCount: "Contagem",
  operationAvg: "Média",
  operationMin: "Mínimo",
  operationMax: "Máximo",
  summaryAddItem: "Adicionar item",
  summaryRemoveItem: "Remover item",
  summaryNewItemLabel: "Novo item",

  styleFontSize: "Tamanho da fonte",
  styleHeaderFontSize: "Tamanho da fonte do cabeçalho",
  styleZebraStripes: "Linhas zebradas",
  styleShowGridLines: "Exibir linhas de grade",
  styleDensity: "Densidade",
  styleAccentColor: "Cor de destaque",
  densityCompact: "Compacta",
  densityNormal: "Normal",
  densityRelaxed: "Espaçosa",
};
