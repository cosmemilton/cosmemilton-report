"use client";

// Rótulos pt-BR do CmReportDesigner. `CmReportDesignerLabels` estende
// `CmReportLayoutEditorLabels` (abas Colunas/Cabeçalho/Sumário/Estilo, campos de coluna) porque o
// designer REUTILIZA `HeaderTab`/`StyleTab`/`SummaryTab` do editor por trás de wrappers finos (ver
// `cm-report-designer.tsx`) e os subcomponentes de `column-fields.tsx` na própria aba Colunas —
// esses componentes tipam `labels` como `CmReportLayoutEditorLabels`, então qualquer objeto de
// labels do designer precisa satisfazer esse tipo por completo. As chaves abaixo de
// `CmReportLayoutEditorLabels` são só as ADICIONAIS: nome/slug/fonte de dados, a lista de campos
// da fonte, agrupamento, rodapé (salvar/cancelar) e mensagens de validação.
import {
  defaultReportLayoutEditorLabels,
  type CmReportLayoutEditorLabels,
} from "../editor/labels.js";

export type CmReportDesignerLabels = CmReportLayoutEditorLabels & {
  // Cabeçalho do form
  reportNameLabel: string;
  reportNamePlaceholder: string;
  slugLabel: string;
  slugPlaceholder: string;
  dataSourceLabel: string;
  dataSourcePlaceholder: string;

  // Seção "Dados" (lista de campos da fonte selecionada)
  addAsColumnButton: string;
  columnAlreadyAdded: string;
  selectDataSourceEmptyTitle: string;
  selectDataSourceEmptyDescription: string;

  // Aba Colunas do designer (colunas completas, não overrides — inclui remover)
  removeColumnButton: string;
  columnsTabEmpty: string;

  // Seção "Agrupamento"
  groupSectionTitle: string;
  groupByLabel: string;
  groupByNone: string;
  groupShowSubtotal: string;

  // Rodapé
  saveButton: string;
  cancelButton: string;

  // Validação/erros
  validationNameRequired: string;
  validationColumnsRequired: string;
  validationInvalidDefinition: string;
  saveErrorTitle: string;
  saveErrorFallback: string;
};

export const defaultReportDesignerLabels: CmReportDesignerLabels = {
  ...defaultReportLayoutEditorLabels,

  reportNameLabel: "Nome do relatório",
  reportNamePlaceholder: "Ex.: Relatório de Vendas",
  slugLabel: "Slug",
  slugPlaceholder: "ex-relatorio-de-vendas",
  dataSourceLabel: "Fonte de dados",
  dataSourcePlaceholder: "Selecione uma fonte de dados",

  addAsColumnButton: "Adicionar como coluna",
  columnAlreadyAdded: "Coluna já adicionada",
  selectDataSourceEmptyTitle: "Selecione uma fonte de dados para começar",
  selectDataSourceEmptyDescription: "Escolha uma fonte de dados para ver os campos disponíveis.",

  removeColumnButton: "Remover coluna",
  columnsTabEmpty: "Nenhuma coluna adicionada — use a lista de campos da fonte para adicionar.",

  groupSectionTitle: "Agrupamento",
  groupByLabel: "Agrupar por",
  groupByNone: "Nenhum",
  groupShowSubtotal: "Exibir subtotal",

  saveButton: "Salvar relatório",
  cancelButton: "Cancelar",

  validationNameRequired: "Informe o nome do relatório",
  validationColumnsRequired: "Adicione ao menos uma coluna",
  validationInvalidDefinition: "Não foi possível salvar: verifique os dados do relatório.",
  saveErrorTitle: "Não foi possível salvar o relatório",
  saveErrorFallback: "Falha ao salvar o relatório.",
};
