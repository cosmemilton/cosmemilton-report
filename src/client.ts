// Entry /client — hooks, editor, preview e designer ("use client" nos arquivos, não no barrel).
// Fase 7: download + hooks (useReportExport, useReportViews, useReportDefinitions).
// Fase 8: CmReportLayoutEditor. Fase 9: CmReportPdfPreview. Fase 10: CmReportDesigner.
export { downloadBlob, downloadReportFile } from "./client/download.js";

export type { UseReportExportOptions, UseReportExportReturn } from "./client/use-report-export.js";
export { useReportExport } from "./client/use-report-export.js";

export type { UseReportViewsOptions, UseReportViewsReturn } from "./client/use-report-views.js";
export { useReportViews } from "./client/use-report-views.js";

export type {
  UseReportDefinitionsOptions,
  UseReportDefinitionsReturn,
} from "./client/use-report-definitions.js";
export { useReportDefinitions } from "./client/use-report-definitions.js";

export type {
  CmReportGlobalConfigEditorLabels,
  CmReportGlobalConfigEditorProps,
} from "./client/global-config-editor.js";
export {
  CmReportGlobalConfigEditor,
  defaultReportGlobalConfigEditorLabels,
} from "./client/global-config-editor.js";

export type { CmReportLayoutEditorProps } from "./client/editor/cm-report-layout-editor.js";
export { CmReportLayoutEditor } from "./client/editor/cm-report-layout-editor.js";
export type { CmReportLayoutEditorLabels } from "./client/editor/labels.js";
export { defaultReportLayoutEditorLabels } from "./client/editor/labels.js";

export type { CmReportPdfPreviewProps } from "./client/preview/cm-report-pdf-preview.js";
export { CmReportPdfPreview } from "./client/preview/cm-report-pdf-preview.js";

export type { CmReportDesignerProps } from "./client/designer/cm-report-designer.js";
export { CmReportDesigner } from "./client/designer/cm-report-designer.js";
export type { CmReportDesignerLabels } from "./client/designer/labels.js";
export { defaultReportDesignerLabels } from "./client/designer/labels.js";
