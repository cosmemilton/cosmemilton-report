// Formatação de valores de célula usando Intl nativo (pt-BR/BRL por default).
import type { ReportCellValue, ReportFormat, ReportFormatOptions } from "./types.js";

// Um relatório usa a mesma formatação em milhares de células. Evita recriar o
// formatter Intl a cada valor, mantendo um limite para configurações por usuário.
const numberFormats = new Map<string, Intl.NumberFormat>();
const MAX_NUMBER_FORMATS = 64;

function numberFormat(
  format: "currency" | "number" | "integer" | "percent",
  locale: string,
  currency: string,
  decimals: number,
): Intl.NumberFormat {
  const key = JSON.stringify([
    format,
    locale,
    format === "currency" ? currency : format === "integer" ? 0 : decimals,
  ]);
  const cached = numberFormats.get(key);
  if (cached) {
    numberFormats.delete(key);
    numberFormats.set(key, cached);
    return cached;
  }
  const formatter = new Intl.NumberFormat(
    locale,
    format === "currency"
      ? { style: "currency", currency }
      : {
          ...(format === "percent" ? { style: "percent" } : {}),
          minimumFractionDigits: format === "integer" ? 0 : decimals,
          maximumFractionDigits: format === "integer" ? 0 : decimals,
        },
  );
  if (numberFormats.size >= MAX_NUMBER_FORMATS) {
    numberFormats.delete(numberFormats.keys().next().value!);
  }
  numberFormats.set(key, formatter);
  return formatter;
}

/** Converte um valor de célula em número finito, ou `null` quando não é numérico.
 *  Exportado para reuso por `summary.ts`/`dataset.ts` — evita reimplementar a mesma coerção. */
export function toNumber(value: ReportCellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Interpreta um valor de célula como data. String ISO "aaaa-mm-dd" (sem hora) é tratada
 *  como data LOCAL (não UTC), para evitar o dia mudar por causa do fuso horário. */
function parseDateValue(value: ReportCellValue): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formata apenas a parte de data como dd/mm/aaaa. */
function formatDatePart(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Formata apenas a parte de hora como hh:mm. */
function formatTimePart(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Formata um valor de célula de acordo com `format`.
 * - `null`/`undefined` sempre viram string vazia.
 * - `boolean` sempre vira "Sim"/"Não", independente do `format` pedido.
 * - `currency`/`number`/`integer`/`percent` usam `Intl.NumberFormat`.
 * - `date`/`datetime` aceitam `Date`, string ISO ou epoch (ms); valor inválido vira "".
 */
export function formatValue(
  value: ReportCellValue,
  format: ReportFormat,
  options?: ReportFormatOptions,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  const locale = options?.locale ?? "pt-BR";
  const currency = options?.currency ?? "BRL";
  const decimals = options?.decimals ?? 2;

  switch (format) {
    case "currency": {
      const n = toNumber(value);
      if (n === null) return "";
      return numberFormat(format, locale, currency, decimals).format(n);
    }
    case "number": {
      const n = toNumber(value);
      if (n === null) return "";
      return numberFormat(format, locale, currency, decimals).format(n);
    }
    case "integer": {
      const n = toNumber(value);
      if (n === null) return "";
      return numberFormat(format, locale, currency, decimals).format(n);
    }
    case "percent": {
      const n = toNumber(value);
      if (n === null) return "";
      return numberFormat(format, locale, currency, decimals).format(n);
    }
    case "date": {
      const date = parseDateValue(value);
      return date ? formatDatePart(date) : "";
    }
    case "datetime": {
      const date = parseDateValue(value);
      return date ? `${formatDatePart(date)} ${formatTimePart(date)}` : "";
    }
    case "text":
    default:
      return String(value);
  }
}
