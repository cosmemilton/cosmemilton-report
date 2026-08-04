// Entry /next — helpers de route handler (Response com Content-Disposition). Não importa nada
// de "next" (Response é padrão Web) — o nome do entry é só semântico. pdf/xlsx são carregados
// dinamicamente por `renderReportResponse`, então este entry continua livre desses peers.
export type { RenderReportResponseInput, ReportResponseOptions } from "./next/report-response.js";
export { renderReportResponse, reportMimeTypes, reportResponse } from "./next/report-response.js";
