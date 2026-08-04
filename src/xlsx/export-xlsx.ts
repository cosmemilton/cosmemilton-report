// export-xlsx.ts — exportReportToXlsx: input → resolveReport → buildReportDataset → workbook
// XLSX de 1 worksheet, via exceljs (peer opcional; NUNCA importado por src/core/*, src/index.ts
// ou src/pdf*, só por este entry).
import ExcelJS from "exceljs";
import { buildReportDataset } from "../core/dataset.js";
import { resolveReport } from "../core/resolve.js";
import type {
  ReportCellValue,
  ReportDataset,
  ReportDatasetCell,
  ReportFormat,
  ReportRenderInput,
} from "../core/types.js";

export type XlsxOptions = {
  sheetName?: string;
  autoFilter?: boolean;
  freezeHeader?: boolean;
  columnWidthScale?: number;
};

type XlsxColumn = ReportDataset["columns"][number];

const MAX_SHEET_NAME_LENGTH = 31;
// Caracteres proibidos pelo Excel em nome de aba: \ / ? * [ ] :
const INVALID_SHEET_NAME_CHARS = /[\\/?*[\]:]/g;

/** Sanitiza o título do relatório para virar um nome de aba válido: remove os caracteres
 *  proibidos pelo Excel, corta em 31 caracteres, e cai em "Relatório" quando o resultado fica
 *  vazio (ex.: título só com caracteres inválidos). */
function sanitizeSheetName(title: string): string {
  const cleaned = title
    .replace(INVALID_SHEET_NAME_CHARS, "")
    .trim()
    .slice(0, MAX_SHEET_NAME_LENGTH)
    .trim();
  return cleaned || "Relatório";
}

/** Converte uma cor "#rrggbb" (ou "rrggbb") em ARGB opaco "FFRRGGBB", formato usado pelo
 *  exceljs em `font.color`/`fill.fgColor`. Cor mal formada cai no cinza-escuro default. */
function toArgb(hex: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  const rgb = (match ? match[1] : "1f2937").toUpperCase();
  return `FF${rgb}`;
}

/**
 * `numFmt` do Excel por formato de coluna — sintaxe US (`#,##0.00`, `0.00%`), não pt-BR: a
 * localização de exibição fica a cargo do Excel do usuário (ver plano, seção "Riscos"). Moeda
 * usa o prefixo já resolvido (`currencyPrefix`: "R$" para BRL, senão o próprio código ISO).
 * `text` não tem `numFmt` (mantém o formato "Geral" do Excel).
 */
function numFmtFor(format: ReportFormat, currencyPrefix: string): string | undefined {
  switch (format) {
    case "currency":
      return `"${currencyPrefix}" #,##0.00`;
    case "number":
      return "#,##0.00";
    case "integer":
      return "#,##0";
    case "percent":
      return "0.00%";
    case "date":
      return "dd/mm/yyyy";
    case "datetime":
      return "dd/mm/yyyy hh:mm";
    case "text":
    default:
      return undefined;
  }
}

/** Interpreta um valor bruto de célula como `Date` — mesma lógica de `parseDateValue` em
 *  `core/formatters.ts` (não exportada de lá), duplicada aqui para manter este módulo isolado do
 *  core sem criar um acoplamento desnecessário por causa de uma função de poucas linhas. Aceita
 *  `Date`, epoch (ms) ou string ISO ("aaaa-mm-dd" tratada como data LOCAL, como em `formatValue`). */
function parseCellDate(value: ReportCellValue): Date | null {
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

/**
 * Valor a escrever na célula do Excel a partir de `{raw, formatted}`: `number` continua
 * `number`, `Date`/epoch/ISO em colunas `date`/`datetime` viram `Date` (o `numFmt` cuida da
 * exibição), `boolean` vira o texto pt-BR já formatado ("Sim"/"Não" — Excel não teria como
 * mostrar isso automaticamente para um `true`/`false` bruto) e o resto (string, já o caso mais
 * comum de `format: "text"`) passa direto.
 */
function toCellValue(cell: ReportDatasetCell, format: ReportFormat): ExcelJS.CellValue {
  const { raw } = cell;
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "boolean") {
    return cell.formatted;
  }
  if (format === "date" || format === "datetime") {
    const date = raw instanceof Date ? raw : parseCellDate(raw);
    return date ?? cell.formatted;
  }
  return raw;
}

/** Constrói o workbook a partir do `dataset`/`resolved`, isolado de `exportReportToXlsx` para
 *  manter a função pública curta. */
function buildWorkbook<T>(
  resolved: ReturnType<typeof resolveReport<T>>,
  dataset: ReportDataset,
  options: Required<XlsxOptions>,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheetName = options.sheetName || sanitizeSheetName(resolved.title);
  const worksheet = workbook.addWorksheet(sheetName);

  const columns: XlsxColumn[] = dataset.columns;
  const currencyPrefix =
    resolved.formatOptions.currency === "BRL" ? "R$" : resolved.formatOptions.currency;
  const numFmts = columns.map((column) => numFmtFor(column.format, currencyPrefix));

  // Só largura — sem `header`/`key`, para a linha 1 ficar livre para o header estilizado abaixo.
  worksheet.columns = columns.map((column) => ({
    width: Math.max(8, column.widthPct * options.columnWidthScale),
  }));

  const headerRow = worksheet.addRow(columns.map((column) => column.header));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: toArgb(resolved.style.accentColor) },
  };
  columns.forEach((column, index) => {
    headerRow.getCell(index + 1).alignment = { horizontal: column.align };
  });

  // Header é sempre a linha 1 (mesmo com grupos/subtotais/total abaixo) — freeze e autoFilter
  // continuam válidos nesses casos.
  if (options.freezeHeader) {
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  if (options.autoFilter && columns.length > 0) {
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  function writeDataRow(cells: ReportDatasetCell[]): void {
    const values = cells.map((cell, index) => toCellValue(cell, columns[index].format));
    const row = worksheet.addRow(values);
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.alignment = { horizontal: column.align };
      const numFmt = numFmts[index];
      if (numFmt) {
        cell.numFmt = numFmt;
      }
    });
  }

  /** Linha de subtotal/total: rótulo em negrito na 1ª coluna (só quando ela não é totalizável —
   *  mesma regra do `ReportPdfTable`/`AggregateRow`), valores `raw` numéricos com `numFmt` nas
   *  colunas totalizáveis. */
  function writeAggregateRow(aggregate: (ReportDatasetCell | null)[], label: string): void {
    const values = aggregate.map((cell, index) => (cell ? cell.raw : index === 0 ? label : null));
    const row = worksheet.addRow(values);
    row.font = { bold: true };
    aggregate.forEach((cell, index) => {
      const numFmt = numFmts[index];
      if (cell && numFmt) {
        row.getCell(index + 1).numFmt = numFmt;
      }
    });
  }

  if (dataset.groups) {
    for (const group of dataset.groups) {
      const groupRow = worksheet.addRow([group.label]);
      groupRow.getCell(1).font = { bold: true };
      if (columns.length > 1) {
        worksheet.mergeCells(groupRow.number, 1, groupRow.number, columns.length);
      }
      for (const row of group.rows) {
        writeDataRow(row.cells);
      }
      if (group.subtotal) {
        writeAggregateRow(group.subtotal, "Subtotal");
      }
    }
  } else {
    for (const row of dataset.rows) {
      writeDataRow(row.cells);
    }
  }

  if (dataset.total) {
    writeAggregateRow(dataset.total, "Total");
  }

  if (dataset.summary.length > 0) {
    worksheet.addRow([]);
    // `dataset.summary` (ReportComputedSummaryItem) não carrega o `format` do item original —
    // zipar com `resolved.summary` (mesma ordem/tamanho, ambos derivados de `computeSummary`)
    // pra reconstruir o mesmo fallback format usado por `computeSummary` ao formatar o valor.
    const columnsByKey = new Map(resolved.columns.map((column) => [column.key, column]));
    resolved.summary.forEach((item, index) => {
      const computed = dataset.summary[index];
      if (!computed) {
        return;
      }
      const column = item.sourceColumn === "*" ? undefined : columnsByKey.get(item.sourceColumn);
      const format = item.format ?? column?.format ?? "number";
      const numFmt = numFmtFor(format, currencyPrefix);

      const row = worksheet.addRow([computed.label]);
      row.getCell(1).font = { bold: true };
      const valueCell = row.getCell(2);
      if (numFmt) {
        valueCell.value = computed.value;
        valueCell.numFmt = numFmt;
      } else {
        valueCell.value = computed.formatted;
      }
    });
  }

  return workbook;
}

/**
 * Exporta `input` (definição + linhas + camadas de config) para um buffer XLSX de 1 worksheet:
 * `resolveReport` → `buildReportDataset` → workbook estilizado (header em negrito com
 * `accentColor`, células com valor `raw` e `numFmt` por formato de coluna, grupos com subtotal e
 * total geral em negrito, sumário ao final). Roda em Node e browser — o README recomenda o
 * caminho server (route handler) para manter `exceljs` fora do bundle client.
 */
export async function exportReportToXlsx<T>(
  input: ReportRenderInput<T>,
  options?: XlsxOptions,
): Promise<Uint8Array> {
  const resolvedOptions: Required<XlsxOptions> = {
    sheetName: options?.sheetName ?? "",
    autoFilter: options?.autoFilter ?? true,
    freezeHeader: options?.freezeHeader ?? true,
    columnWidthScale: options?.columnWidthScale ?? 0.9,
  };

  const resolved = resolveReport({
    definition: input.definition,
    globalConfig: input.globalConfig,
    view: input.view,
    overrides: input.overrides,
  });
  const dataset = buildReportDataset(resolved, input.rows, {
    userName: input.userName,
    generatedAt: input.generatedAt,
  });

  const workbook = buildWorkbook(resolved, dataset, resolvedOptions);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
