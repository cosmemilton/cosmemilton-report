// Tipos centrais do cosmemilton-report.
// Este módulo não importa nada em runtime (só type-only de "react"), garantindo
// que o entry core continue zero-dependency e seguro para uso no servidor.
import type { ReactElement } from "react";

/** Formatos de célula suportados por `formatValue` e pelas colunas de relatório. */
export type ReportFormat =
  "text" | "number" | "integer" | "currency" | "percent" | "date" | "datetime";

/** Opções de formatação — defaults pt-BR/BRL quando omitidas. */
export type ReportFormatOptions = { locale?: string; currency?: string; decimals?: number };

/** Valor bruto de uma célula, antes da formatação. */
export type ReportCellValue = string | number | boolean | Date | null | undefined;

export type ReportColumnAlign = "left" | "center" | "right";

/** Key com autocomplete dos campos de T, mas aceitando strings livres (colunas derivadas). */
export type ReportColumnKey<T> = (keyof T & string) | (string & Record<never, never>);

/** Coluna da DEFINIÇÃO (código; pode conter funções — nunca persistida). */
export type ReportColumn<T> = {
  key: ReportColumnKey<T>;
  header: string;
  width?: `${number}%`; // re-normalizada quando colunas são ocultadas
  align?: ReportColumnAlign; // default: "right" p/ formatos numéricos, senão "left"
  format?: ReportFormat; // default "text"
  visible?: boolean; // default true
  hideable?: boolean; // default true — se false, editor não permite ocultar
  sortOrder?: number; // default: índice no array
  noTotal?: boolean; // exclui de subtotal/total
  exportValue?: (row: T) => ReportCellValue; // default: (row) => row[key]; usado por TODOS os formatos
  pdfRender?: (ctx: ReportPdfCellContext<T>) => ReactElement; // SÓ PDF; retornar Text/View do react-pdf
};

export type ReportPdfCellContext<T> = {
  row: T;
  value: ReportCellValue;
  formatted: string;
  column: ResolvedReportColumn<T>;
  style: ReportStyleConfig;
};

/** Override serializável de coluna gravado na view (mesclado por key). */
export type ReportViewColumn = {
  key: string;
  header?: string;
  width?: `${number}%`;
  align?: ReportColumnAlign;
  format?: ReportFormat;
  visible?: boolean;
  sortOrder?: number;
};

/** Coluna após merge definição+view, defaults aplicados, largura normalizada. */
export type ResolvedReportColumn<T> = {
  key: string;
  header: string;
  widthPct: number;
  align: ReportColumnAlign;
  format: ReportFormat;
  visible: boolean;
  hideable: boolean;
  sortOrder: number;
  noTotal: boolean;
  exportValue: (row: T) => ReportCellValue;
  pdfRender?: (ctx: ReportPdfCellContext<T>) => ReactElement;
};

export type ReportHeaderConfig = {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showCompanyName?: boolean;
  showGeneratedAt?: boolean;
  showUserName?: boolean;
  showPageNumbers?: boolean;
};

export type ReportStyleConfig = {
  fontSize?: number; // pt; default 8
  headerFontSize?: number; // default 12
  zebraStripes?: boolean; // default true
  showGridLines?: boolean; // default false
  accentColor?: string; // default "#1f2937"
  density?: "compact" | "normal" | "relaxed";
};

export type ReportSummaryOperation = "sum" | "count" | "avg" | "min" | "max";
export type ReportSummaryItem = {
  label: string;
  sourceColumn: string; // "*" = contagem de linhas
  operation: ReportSummaryOperation;
  format?: ReportFormat;
};

export type ReportGroupConfig<T> = {
  by: string | ((row: T) => string);
  label?: (groupKey: string, rows: T[]) => string;
  showSubtotal?: boolean; // default true
};

export type ReportSectionContext<T> = {
  rows: T[];
  resolved: ResolvedReport<T>;
  generatedAt: Date;
  userName?: string;
};
export type ReportSection<T> = {
  id: string;
  position: "before-table" | "after-table" | "after-summary";
  pdfRender: (ctx: ReportSectionContext<T>) => ReactElement;
};

/** Definição de relatório (código, registrada no app). Pode conter funções. */
export type ReportDefinition<T> = {
  slug: string;
  name: string;
  description?: string;
  /** id da fonte de dados registrada no app (usado por relatórios criados no designer). */
  dataSource?: string;
  columns: ReportColumn<T>[];
  summary?: ReportSummaryItem[];
  header?: ReportHeaderConfig;
  style?: ReportStyleConfig;
  group?: ReportGroupConfig<T>;
  sections?: ReportSection<T>[];
};

// ---------- Designer (relatórios criados em runtime — JSON puro, sem funções) ----------

export type SerializableReportColumn = {
  key: string;
  header: string;
  width?: `${number}%`;
  align?: ReportColumnAlign;
  format?: ReportFormat;
  visible?: boolean;
  hideable?: boolean;
  sortOrder?: number;
  noTotal?: boolean;
};

/** Toda SerializableReportDefinition é uma ReportDefinition<Record<string, unknown>> válida
 *  (funções são todas opcionais) — hidratar é só passar adiante. */
export type SerializableReportDefinition = {
  slug: string;
  name: string;
  description?: string;
  dataSource?: string;
  columns: SerializableReportColumn[];
  summary?: ReportSummaryItem[];
  header?: ReportHeaderConfig;
  style?: ReportStyleConfig;
  group?: { by: string; showSubtotal?: boolean }; // só key de coluna, sem funções
};

/** Fonte de dados que o app registra para o designer oferecer ao usuário.
 *  A BUSCA dos dados continua sendo do app (mapa dataSource.id → fetcher). */
export type ReportDataSourceField = { key: string; label: string; format?: ReportFormat };
export type ReportDataSource = {
  id: string;
  name: string;
  description?: string;
  fields: ReportDataSourceField[];
};

export type ReportView = {
  id: string; // system view: `system:${slug}`
  slug: string;
  name: string;
  isSystem: boolean; // true = read-only, nascida do registry
  isDefault: boolean;
  columns?: ReportViewColumn[];
  header?: ReportHeaderConfig;
  style?: ReportStyleConfig;
  summary?: ReportSummaryItem[]; // se presente, SUBSTITUI o da definição
  updatedAt?: string;
};

export type ReportPaperSize = "A4" | "Letter";
export type ReportOrientation = "portrait" | "landscape";
export type ReportGlobalConfig = {
  companyName?: string;
  logoUrl?: string;
  showLogo: boolean;
  showCompanyName: boolean;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  footerText?: string;
  locale: string;
  currency: string;
  fontFamily?: string; // registrada via registerReportFonts; default Helvetica
  header: Required<ReportHeaderConfig>;
  style: Required<ReportStyleConfig>;
};

export type ReportRenderOverrides = {
  title?: string;
  subtitle?: string;
  orientation?: ReportOrientation;
  paperSize?: ReportPaperSize;
  header?: ReportHeaderConfig;
  style?: ReportStyleConfig;
};

/** Relatório totalmente resolvido: resultado do merge de todas as camadas de config. */
export type ResolvedReport<T> = {
  slug: string;
  title: string;
  subtitle?: string;
  columns: ResolvedReportColumn<T>[];
  visibleColumns: ResolvedReportColumn<T>[];
  summary: ReportSummaryItem[];
  header: Required<ReportHeaderConfig>;
  style: Required<ReportStyleConfig>;
  group?: ReportGroupConfig<T>;
  sections: ReportSection<T>[];
  page: {
    paperSize: ReportPaperSize;
    orientation: ReportOrientation;
    marginTopMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    marginRightMm: number;
  };
  branding: { companyName?: string; logoUrl?: string; showLogo: boolean; showCompanyName: boolean };
  formatOptions: Required<Pick<ReportFormatOptions, "locale" | "currency">>;
  fontFamily?: string;
};

export type ReportDatasetCell = { raw: ReportCellValue; formatted: string };
export type ReportDatasetRow = { cells: ReportDatasetCell[] };
export type ReportDatasetGroup = {
  key: string;
  label: string;
  rows: ReportDatasetRow[];
  subtotal?: (ReportDatasetCell | null)[];
};
export type ReportComputedSummaryItem = { label: string; value: number; formatted: string };
export type ReportDataset = {
  columns: Pick<
    ResolvedReportColumn<unknown>,
    "key" | "header" | "align" | "format" | "widthPct" | "noTotal"
  >[];
  rows: ReportDatasetRow[];
  groups?: ReportDatasetGroup[];
  total?: (ReportDatasetCell | null)[];
  summary: ReportComputedSummaryItem[];
  meta: { title: string; subtitle?: string; generatedAt: Date; userName?: string };
};

/** Input unificado de todos os exporters. */
export type ReportRenderInput<T> = {
  definition: ReportDefinition<T>;
  rows: T[];
  globalConfig?: Partial<ReportGlobalConfig>;
  view?: ReportView | null;
  overrides?: ReportRenderOverrides;
  userName?: string;
  generatedAt?: Date;
};

export type ReportOutputFormat = "pdf" | "csv" | "xlsx" | "json" | "tsv";
