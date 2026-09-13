// Valores default para as camadas de configuração do relatório.
// Servem tanto como base do merge em `resolveReport` quanto como "reset de graça"
// para quem quiser restaurar a config global/cabeçalho/estilo original.
import type {
  ReportGlobalConfig,
  ReportHeaderConfig,
  ReportPaperSize,
  ReportStyleConfig,
  ResolvedReport,
} from "./types.js";

/** Cabeçalho default: título/subtítulo vazios, tudo visível exceto o nome do usuário. */
export const defaultReportHeader: Required<ReportHeaderConfig> = {
  title: "",
  subtitle: "",
  showLogo: true,
  showCompanyName: true,
  showGeneratedAt: true,
  showUserName: false,
  showPageNumbers: true,
};

/** Estilo default da tabela/PDF. */
export const defaultReportStyle: Required<ReportStyleConfig> = {
  fontSize: 8,
  headerFontSize: 12,
  zebraStripes: true,
  showGridLines: false,
  accentColor: "#1f2937",
  density: "normal",
};

/** Config global default: papel A4 retrato, margens 15/15/10/10mm, locale/moeda pt-BR/BRL. */
export const defaultReportGlobalConfig: ReportGlobalConfig = {
  companyName: undefined,
  logoUrl: undefined,
  showLogo: true,
  showCompanyName: true,
  paperSize: "A4",
  orientation: "portrait",
  marginTopMm: 15,
  marginBottomMm: 15,
  marginLeftMm: 10,
  marginRightMm: 10,
  footerText: undefined,
  locale: "pt-BR",
  currency: "BRL",
  fontFamily: undefined,
  header: defaultReportHeader,
  style: defaultReportStyle,
};

/** Defaults de página compartilhados por resolução, storage e editor. Margens explícitas
 *  continuam prevalecendo; rolos térmicos usam 3 mm quando a margem não foi informada. */
export function getReportPageDefaults(paperSize: ReportPaperSize): ResolvedReport<unknown>["page"] {
  const thermal = paperSize === "58mm" || paperSize === "80mm";
  return {
    paperSize,
    orientation: "portrait",
    marginTopMm: thermal ? 3 : defaultReportGlobalConfig.marginTopMm,
    marginBottomMm: thermal ? 3 : defaultReportGlobalConfig.marginBottomMm,
    marginLeftMm: thermal ? 3 : defaultReportGlobalConfig.marginLeftMm,
    marginRightMm: thermal ? 3 : defaultReportGlobalConfig.marginRightMm,
  };
}
