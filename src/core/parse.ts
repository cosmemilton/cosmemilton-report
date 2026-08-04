// Parsing defensivo na fronteira de persistência: `raw` vem de storage (localStorage, banco,
// resposta de API) e não é confiável. Cada função aqui aceita `unknown`, valida campo a campo
// (Sets de literais, coerção por `typeof`) e nunca lança — valor inválido cai silenciosamente
// no default ou é descartado, dependendo do campo.
import { defaultReportGlobalConfig, defaultReportHeader, defaultReportStyle } from "./defaults.js";
import type {
  ReportColumnAlign,
  ReportFormat,
  ReportGlobalConfig,
  ReportHeaderConfig,
  ReportOrientation,
  ReportPaperSize,
  ReportStyleConfig,
  ReportSummaryItem,
  ReportSummaryOperation,
  ReportView,
  ReportViewColumn,
  SerializableReportColumn,
  SerializableReportDefinition,
} from "./types.js";

// ---------- type guards genéricos ----------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWidthString(value: unknown): value is `${number}%` {
  return typeof value === "string" && /^\d+(\.\d+)?%$/.test(value);
}

// ---------- Sets de valores válidos por campo ----------

const PAPER_SIZES = new Set<ReportPaperSize>(["A4", "Letter"]);
const ORIENTATIONS = new Set<ReportOrientation>(["portrait", "landscape"]);
const DENSITIES = new Set<NonNullable<ReportStyleConfig["density"]>>([
  "compact",
  "normal",
  "relaxed",
]);
const FORMATS = new Set<ReportFormat>([
  "text",
  "number",
  "integer",
  "currency",
  "percent",
  "date",
  "datetime",
]);
const ALIGNS = new Set<ReportColumnAlign>(["left", "center", "right"]);
const SUMMARY_OPERATIONS = new Set<ReportSummaryOperation>(["sum", "count", "avg", "min", "max"]);

// ---------- header/style: mesma validação campo a campo, reaproveitada em global/view/definição ----------

/** Extrai só os campos válidos de um header de storage — campos ausentes/inválidos ficam de
 *  fora (não são preenchidos com default aqui; quem decide o default é o chamador). */
function parsePartialHeaderConfig(raw: unknown): ReportHeaderConfig | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }

  const result: ReportHeaderConfig = {};
  if (typeof raw.title === "string") result.title = raw.title;
  if (typeof raw.subtitle === "string") result.subtitle = raw.subtitle;
  if (typeof raw.showLogo === "boolean") result.showLogo = raw.showLogo;
  if (typeof raw.showCompanyName === "boolean") result.showCompanyName = raw.showCompanyName;
  if (typeof raw.showGeneratedAt === "boolean") result.showGeneratedAt = raw.showGeneratedAt;
  if (typeof raw.showUserName === "boolean") result.showUserName = raw.showUserName;
  if (typeof raw.showPageNumbers === "boolean") result.showPageNumbers = raw.showPageNumbers;

  return Object.keys(result).length > 0 ? result : undefined;
}

/** Mesma ideia de `parsePartialHeaderConfig`, para `ReportStyleConfig`. */
function parsePartialStyleConfig(raw: unknown): ReportStyleConfig | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }

  const result: ReportStyleConfig = {};
  if (isFiniteNumber(raw.fontSize) && raw.fontSize >= 0) result.fontSize = raw.fontSize;
  if (isFiniteNumber(raw.headerFontSize) && raw.headerFontSize >= 0) {
    result.headerFontSize = raw.headerFontSize;
  }
  if (typeof raw.zebraStripes === "boolean") result.zebraStripes = raw.zebraStripes;
  if (typeof raw.showGridLines === "boolean") result.showGridLines = raw.showGridLines;
  if (typeof raw.accentColor === "string" && raw.accentColor.length > 0) {
    result.accentColor = raw.accentColor;
  }
  if (DENSITIES.has(raw.density as NonNullable<ReportStyleConfig["density"]>)) {
    result.density = raw.density as ReportStyleConfig["density"];
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseRequiredHeaderConfig(raw: unknown): Required<ReportHeaderConfig> {
  return { ...defaultReportHeader, ...parsePartialHeaderConfig(raw) };
}

function parseRequiredStyleConfig(raw: unknown): Required<ReportStyleConfig> {
  return { ...defaultReportStyle, ...parsePartialStyleConfig(raw) };
}

/**
 * Parseia a config global do relatório a partir de um `raw` não confiável (ex.: JSON de
 * localStorage). Parte de `{ ...defaultReportGlobalConfig }`; cada campo só é sobrescrito
 * quando o valor em `raw` é válido para aquele campo — senão o default silenciosamente
 * permanece. `raw` que não é objeto retorna o default completo. Nunca lança.
 */
export function parseReportGlobalConfig(raw: unknown): ReportGlobalConfig {
  const base = defaultReportGlobalConfig;
  if (!isPlainObject(raw)) {
    return { ...base };
  }

  const result: ReportGlobalConfig = { ...base };

  if (typeof raw.companyName === "string") result.companyName = raw.companyName;
  if (typeof raw.logoUrl === "string") result.logoUrl = raw.logoUrl;
  if (typeof raw.showLogo === "boolean") result.showLogo = raw.showLogo;
  if (typeof raw.showCompanyName === "boolean") result.showCompanyName = raw.showCompanyName;

  result.paperSize = PAPER_SIZES.has(raw.paperSize as ReportPaperSize)
    ? (raw.paperSize as ReportPaperSize)
    : base.paperSize;
  result.orientation = ORIENTATIONS.has(raw.orientation as ReportOrientation)
    ? (raw.orientation as ReportOrientation)
    : base.orientation;

  if (isFiniteNumber(raw.marginTopMm) && raw.marginTopMm >= 0) result.marginTopMm = raw.marginTopMm;
  if (isFiniteNumber(raw.marginBottomMm) && raw.marginBottomMm >= 0) {
    result.marginBottomMm = raw.marginBottomMm;
  }
  if (isFiniteNumber(raw.marginLeftMm) && raw.marginLeftMm >= 0) {
    result.marginLeftMm = raw.marginLeftMm;
  }
  if (isFiniteNumber(raw.marginRightMm) && raw.marginRightMm >= 0) {
    result.marginRightMm = raw.marginRightMm;
  }

  if (typeof raw.footerText === "string") result.footerText = raw.footerText;
  if (typeof raw.locale === "string" && raw.locale.length > 0) result.locale = raw.locale;
  if (typeof raw.currency === "string" && raw.currency.length > 0) result.currency = raw.currency;
  if (typeof raw.fontFamily === "string") result.fontFamily = raw.fontFamily;

  result.header = parseRequiredHeaderConfig(raw.header);
  result.style = parseRequiredStyleConfig(raw.style);

  return result;
}

// ---------- colunas de view (overrides serializáveis) ----------

function parseViewColumn(raw: unknown): ReportViewColumn | null {
  if (!isPlainObject(raw) || !isNonEmptyString(raw.key)) {
    return null;
  }

  const column: ReportViewColumn = { key: raw.key };
  if (typeof raw.header === "string") column.header = raw.header;
  if (isWidthString(raw.width)) column.width = raw.width;
  if (ALIGNS.has(raw.align as ReportColumnAlign)) column.align = raw.align as ReportColumnAlign;
  if (FORMATS.has(raw.format as ReportFormat)) column.format = raw.format as ReportFormat;
  if (typeof raw.visible === "boolean") column.visible = raw.visible;
  if (isFiniteNumber(raw.sortOrder)) column.sortOrder = raw.sortOrder;

  return column;
}

function parseViewColumns(raw: unknown): ReportViewColumn[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.map(parseViewColumn).filter((column): column is ReportViewColumn => column !== null);
}

// ---------- summary (compartilhado entre view e definição) ----------

function parseSummaryItem(raw: unknown): ReportSummaryItem | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (!isNonEmptyString(raw.label) || !isNonEmptyString(raw.sourceColumn)) {
    return null;
  }
  if (!SUMMARY_OPERATIONS.has(raw.operation as ReportSummaryOperation)) {
    return null;
  }

  const item: ReportSummaryItem = {
    label: raw.label,
    sourceColumn: raw.sourceColumn,
    operation: raw.operation as ReportSummaryOperation,
  };
  if (FORMATS.has(raw.format as ReportFormat)) item.format = raw.format as ReportFormat;

  return item;
}

function parseSummaryItems(raw: unknown): ReportSummaryItem[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.map(parseSummaryItem).filter((item): item is ReportSummaryItem => item !== null);
}

/**
 * Parseia uma `ReportView` a partir de um `raw` não confiável. Retorna `null` quando `raw` não
 * é objeto ou não tem `id`/`slug` string não-vazia (irrecuperável). Demais campos seguem a
 * mesma validação defensiva: entradas inválidas de `columns` são descartadas (não a view
 * inteira); `isSystem`/`isDefault` são coeridos para boolean com default `false`; `name` sem
 * valor válido usa o `slug` como default. Nunca lança.
 */
export function parseReportView(raw: unknown): ReportView | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.slug)) {
    return null;
  }

  const slug = raw.slug;
  const view: ReportView = {
    id: raw.id,
    slug,
    name: isNonEmptyString(raw.name) ? raw.name : slug,
    isSystem: typeof raw.isSystem === "boolean" ? raw.isSystem : false,
    isDefault: typeof raw.isDefault === "boolean" ? raw.isDefault : false,
  };

  const columns = parseViewColumns(raw.columns);
  if (columns !== undefined) view.columns = columns;

  const header = parsePartialHeaderConfig(raw.header);
  if (header !== undefined) view.header = header;

  const style = parsePartialStyleConfig(raw.style);
  if (style !== undefined) view.style = style;

  const summary = parseSummaryItems(raw.summary);
  if (summary !== undefined) view.summary = summary;

  if (isNonEmptyString(raw.updatedAt)) view.updatedAt = raw.updatedAt;

  return view;
}

// ---------- colunas/grupo de definição serializável ----------

function parseSerializableColumn(raw: unknown): SerializableReportColumn | null {
  if (!isPlainObject(raw) || !isNonEmptyString(raw.key) || typeof raw.header !== "string") {
    return null;
  }

  // Reconstrói o objeto campo a campo a partir de `raw` — chaves de função (`exportValue`,
  // `pdfRender`) vindas do storage nunca são copiadas: código nunca é confiável vindo de fora.
  const column: SerializableReportColumn = { key: raw.key, header: raw.header };
  if (isWidthString(raw.width)) column.width = raw.width;
  if (ALIGNS.has(raw.align as ReportColumnAlign)) column.align = raw.align as ReportColumnAlign;
  if (FORMATS.has(raw.format as ReportFormat)) column.format = raw.format as ReportFormat;
  if (typeof raw.visible === "boolean") column.visible = raw.visible;
  if (typeof raw.hideable === "boolean") column.hideable = raw.hideable;
  if (isFiniteNumber(raw.sortOrder)) column.sortOrder = raw.sortOrder;
  if (typeof raw.noTotal === "boolean") column.noTotal = raw.noTotal;

  return column;
}

function parseSerializableColumns(raw: unknown): SerializableReportColumn[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(parseSerializableColumn)
    .filter((column): column is SerializableReportColumn => column !== null);
}

function parseSerializableGroup(raw: unknown): SerializableReportDefinition["group"] {
  if (!isPlainObject(raw) || typeof raw.by !== "string") {
    return undefined;
  }
  const group: NonNullable<SerializableReportDefinition["group"]> = { by: raw.by };
  if (typeof raw.showSubtotal === "boolean") group.showSubtotal = raw.showSubtotal;
  return group;
}

/**
 * Parseia uma `SerializableReportDefinition` a partir de um `raw` não confiável (JSON vindo do
 * storage do designer). Retorna `null` quando `raw` não tem `slug`/`name` string não-vazia ou
 * `columns` não resulta em ao menos uma coluna válida (`key` + `header` strings). Formats/aligns
 * são validados por Set; qualquer chave de função presente em `raw` (`exportValue`, `pdfRender`,
 * `group.by` como função etc.) é descartada por construção — o resultado só tem os campos
 * conhecidos e serializáveis. Nunca lança.
 */
export function parseReportDefinition(raw: unknown): SerializableReportDefinition | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  if (!isNonEmptyString(raw.slug) || !isNonEmptyString(raw.name)) {
    return null;
  }

  const columns = parseSerializableColumns(raw.columns);
  if (columns.length === 0) {
    return null;
  }

  const definition: SerializableReportDefinition = { slug: raw.slug, name: raw.name, columns };

  if (typeof raw.description === "string") definition.description = raw.description;
  if (isNonEmptyString(raw.dataSource)) definition.dataSource = raw.dataSource;

  const summary = parseSummaryItems(raw.summary);
  if (summary !== undefined) definition.summary = summary;

  const header = parsePartialHeaderConfig(raw.header);
  if (header !== undefined) definition.header = header;

  const style = parsePartialStyleConfig(raw.style);
  if (style !== undefined) definition.style = style;

  const group = parseSerializableGroup(raw.group);
  if (group !== undefined) definition.group = group;

  return definition;
}
