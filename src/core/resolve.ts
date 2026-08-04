// resolveReport — coração da lib: mescla as camadas de config (default → globalConfig →
// definição → view → overrides) campo a campo, seção por seção.
import { normalizeColumnWidths, resolveColumns } from "./columns.js";
import { defaultReportGlobalConfig, defaultReportHeader, defaultReportStyle } from "./defaults.js";
import type {
  ReportDefinition,
  ReportGlobalConfig,
  ReportHeaderConfig,
  ReportOrientation,
  ReportPaperSize,
  ReportRenderOverrides,
  ReportStyleConfig,
  ReportView,
  ResolvedReport,
} from "./types.js";

/**
 * Aplica em `base` apenas as chaves de `patch` que são `!== undefined` — herança explícita por
 * campo entre camadas de configuração (uma chave `undefined` na camada mais específica herda o
 * valor da camada anterior).
 */
function mergeDefined<T extends object>(base: T, patch?: Partial<T> | null): T {
  if (!patch) {
    return base;
  }
  const result: T = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) {
      result[key] = value as T[keyof T];
    }
  }
  return result;
}

/**
 * Resolve uma `ReportDefinition` (mais globalConfig/view/overrides opcionais) em um
 * `ResolvedReport` pronto para os exporters consumirem. Camadas, da menos para a mais
 * específica: defaults do módulo → `globalConfig` → `definition` → `view` → `overrides`.
 */
export function resolveReport<T>(input: {
  definition: ReportDefinition<T>;
  globalConfig?: Partial<ReportGlobalConfig>;
  view?: ReportView | null;
  overrides?: ReportRenderOverrides;
}): ResolvedReport<T> {
  const { definition, globalConfig, view, overrides } = input;

  // ---- header: default → globalConfig.header → definition.header → view.header → overrides ----
  let header: Required<ReportHeaderConfig> = mergeDefined(
    defaultReportHeader,
    globalConfig?.header,
  );
  header = mergeDefined(header, definition.header);
  header = mergeDefined(header, view?.header);
  header = mergeDefined(header, overrides?.header);
  header = mergeDefined(header, { title: overrides?.title, subtitle: overrides?.subtitle });

  const title = header.title || definition.name;
  const subtitle = header.subtitle || undefined;
  header = { ...header, title };

  // ---- style: default → globalConfig.style → definition.style → view.style → overrides.style ----
  let style: Required<ReportStyleConfig> = mergeDefined(defaultReportStyle, globalConfig?.style);
  style = mergeDefined(style, definition.style);
  style = mergeDefined(style, view?.style);
  style = mergeDefined(style, overrides?.style);

  // ---- page: default → globalConfig (papel/margens) → overrides (orientation/paperSize) ----
  const defaultPage = {
    paperSize: defaultReportGlobalConfig.paperSize,
    orientation: defaultReportGlobalConfig.orientation,
    marginTopMm: defaultReportGlobalConfig.marginTopMm,
    marginBottomMm: defaultReportGlobalConfig.marginBottomMm,
    marginLeftMm: defaultReportGlobalConfig.marginLeftMm,
    marginRightMm: defaultReportGlobalConfig.marginRightMm,
  };
  let page: {
    paperSize: ReportPaperSize;
    orientation: ReportOrientation;
    marginTopMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    marginRightMm: number;
  } = mergeDefined(defaultPage, {
    paperSize: globalConfig?.paperSize,
    orientation: globalConfig?.orientation,
    marginTopMm: globalConfig?.marginTopMm,
    marginBottomMm: globalConfig?.marginBottomMm,
    marginLeftMm: globalConfig?.marginLeftMm,
    marginRightMm: globalConfig?.marginRightMm,
  });
  page = mergeDefined(page, {
    paperSize: overrides?.paperSize,
    orientation: overrides?.orientation,
  });

  // ---- branding: default → globalConfig (não é sobreponível por definição/view/overrides) ----
  const defaultBranding = {
    companyName: defaultReportGlobalConfig.companyName,
    logoUrl: defaultReportGlobalConfig.logoUrl,
    showLogo: defaultReportGlobalConfig.showLogo,
    showCompanyName: defaultReportGlobalConfig.showCompanyName,
  };
  const branding = mergeDefined(defaultBranding, {
    companyName: globalConfig?.companyName,
    logoUrl: globalConfig?.logoUrl,
    showLogo: globalConfig?.showLogo,
    showCompanyName: globalConfig?.showCompanyName,
  });

  // ---- formatOptions: default → globalConfig.locale/currency ----
  const formatOptions = mergeDefined(
    { locale: defaultReportGlobalConfig.locale, currency: defaultReportGlobalConfig.currency },
    { locale: globalConfig?.locale, currency: globalConfig?.currency },
  );

  const fontFamily = globalConfig?.fontFamily ?? defaultReportGlobalConfig.fontFamily;

  // ---- colunas: merge definição+view por key; largura só é normalizada nas visíveis ----
  const columns = resolveColumns(definition.columns, view?.columns).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const visibleColumns = normalizeColumnWidths(columns);

  // ---- summary: se a view define summary, ele SUBSTITUI (não mescla) o da definição ----
  const summary = view?.summary !== undefined ? view.summary : (definition.summary ?? []);

  return {
    slug: definition.slug,
    title,
    subtitle,
    columns,
    visibleColumns,
    summary,
    header,
    style,
    // group e sections só vêm da definição — não são serializáveis/sobrescritos por view.
    group: definition.group,
    sections: definition.sections ?? [],
    page,
    branding,
    formatOptions,
    fontFamily,
  };
}
