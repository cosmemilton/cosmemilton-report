// Entry core (server-safe, zero dependências de runtime).
export type {
  ReportFormat,
  ReportFormatOptions,
  ReportCellValue,
  ReportColumnAlign,
  ReportColumnKey,
  ReportColumn,
  ReportPdfCellContext,
  ReportViewColumn,
  ResolvedReportColumn,
  ReportHeaderConfig,
  ReportStyleConfig,
  ReportSummaryOperation,
  ReportSummaryItem,
  ReportGroupConfig,
  ReportSectionContext,
  ReportSection,
  ReportDefinition,
  SerializableReportColumn,
  SerializableReportDefinition,
  ReportDataSourceField,
  ReportDataSource,
  ReportView,
  ReportPaperSize,
  ReportOrientation,
  ReportGlobalConfig,
  ReportRenderOverrides,
  ResolvedReport,
  ReportDatasetCell,
  ReportDatasetRow,
  ReportDatasetGroup,
  ReportComputedSummaryItem,
  ReportDataset,
  ReportRenderInput,
  ReportOutputFormat,
} from "./core/types.js";

export {
  defaultReportGlobalConfig,
  defaultReportHeader,
  defaultReportStyle,
} from "./core/defaults.js";
export { formatValue } from "./core/formatters.js";
export { defineReport } from "./core/define-report.js";
export { resolveColumns, normalizeColumnWidths } from "./core/columns.js";
export { resolveReport } from "./core/resolve.js";
export type { ReportRegistry } from "./core/registry.js";
export { createReportRegistry, mergeReportDefinitions } from "./core/registry.js";
export { computeSummary } from "./core/summary.js";
export { groupRows } from "./core/groups.js";
export { buildReportDataset } from "./core/dataset.js";
export { generatePlaceholderRows } from "./core/placeholder.js";
export type { CsvOptions } from "./core/serializers/csv.js";
export { datasetToCsv } from "./core/serializers/csv.js";
export { datasetToTsv } from "./core/serializers/tsv.js";
export { datasetToJson } from "./core/serializers/json.js";
export { exportReportToCsv, exportReportToTsv, exportReportToJson } from "./core/export.js";
export { parseReportGlobalConfig, parseReportView, parseReportDefinition } from "./core/parse.js";
export type { ReportStorageAdapter } from "./core/storage/adapter.js";
export { createMemoryReportAdapter } from "./core/storage/memory-adapter.js";
export { createLocalStorageReportAdapter } from "./core/storage/local-storage-adapter.js";
export { createSystemView, ensureReportViews } from "./core/storage/provision.js";
