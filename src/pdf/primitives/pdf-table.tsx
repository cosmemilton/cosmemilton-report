// pdf-table.tsx — tabela do relatório: cabeçalho de colunas, linhas (zebra/gridlines/densidade/
// alinhamento conforme `resolved.style`), grupos com subtotal e total geral.
// Componente interno: não é exportado no barrel `src/pdf.ts`.
//
// Reaproveita o `dataset` (calculado uma única vez por `buildReportDataset` em
// `../create-document.js` e recebido via prop) para os valores formatados e para os números de
// subtotal/total — a MESMA lógica usada pelos serializers CSV/TSV/JSON, então os números batem.
// `rows`/`resolved.group` só são usados aqui para reobter a linha original `T` de cada célula,
// necessária pelo `ReportPdfCellContext` de `column.pdfRender` (o dataset guarda só
// `{raw, formatted}`, não a linha original). `groupRows` é pura e determinística, então chamá-la
// de novo aqui com os mesmos argumentos que `buildReportDataset` usou internamente reproduz
// exatamente o mesmo agrupamento, na mesma ordem — por isso o pareamento por índice é seguro.
import { Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { groupRows } from "../../core/groups.js";
import type {
  ReportDataset,
  ReportDatasetCell,
  ReportPdfCellContext,
  ResolvedReport,
  ResolvedReportColumn,
} from "../../core/types.js";
import { widthPct } from "../map-columns.js";

export type ReportPdfTableProps<T> = {
  resolved: ResolvedReport<T>;
  rows: T[];
  dataset: ReportDataset;
};

const DENSITY_PADDING: Record<"compact" | "normal" | "relaxed", number> = {
  compact: 2,
  normal: 4,
  relaxed: 6,
};

/** Zebra striping usa um cinza fixo (não derivado de `accentColor`) — mantém o v1 simples e
 *  legível em qualquer cor de destaque escolhida pelo usuário. */
const ZEBRA_COLOR = "#f5f5f5";
const GRID_COLOR = "#d1d5db";
const GROUP_BG_COLOR = "#e5e7eb";

function cellStyle<T>(column: ResolvedReportColumn<T>, padding: number, showGridLines: boolean) {
  return {
    width: widthPct(column.widthPct),
    padding,
    ...(showGridLines ? { borderWidth: 0.5, borderColor: GRID_COLOR } : {}),
  };
}

type RowWithOriginal<T> = { row: T; cells: ReportDatasetCell[] };
type GroupWithOriginal<T> = {
  key: string;
  label: string;
  rows: RowWithOriginal<T>[];
  subtotal?: (ReportDatasetCell | null)[];
};

function pairGroupsWithDataset<T>(
  resolved: ResolvedReport<T>,
  rows: T[],
  dataset: ReportDataset,
): GroupWithOriginal<T>[] | null {
  if (!resolved.group) {
    return null;
  }
  const grouped = groupRows(rows, resolved.group);
  return grouped.map((group, groupIndex) => {
    const datasetGroup = dataset.groups?.[groupIndex];
    return {
      key: group.key,
      label: group.label,
      rows: group.rows.map((row, rowIndex) => ({
        row,
        cells: datasetGroup?.rows[rowIndex]?.cells ?? [],
      })),
      subtotal: datasetGroup?.subtotal,
    };
  });
}

function HeaderRow<T>({
  columns,
  style,
  padding,
  showGridLines,
}: {
  columns: ResolvedReportColumn<T>[];
  style: ResolvedReport<T>["style"];
  padding: number;
  showGridLines: boolean;
}): ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: showGridLines ? 0 : 1,
        borderBottomColor: style.accentColor,
      }}
    >
      {columns.map((column) => (
        <View key={column.key} style={cellStyle(column, padding, showGridLines)}>
          <Text
            style={{
              fontSize: style.headerFontSize,
              fontWeight: "bold",
              textAlign: column.align,
              color: style.accentColor,
            }}
          >
            {column.header}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DataRow<T>({
  row,
  cells,
  index,
  columns,
  style,
  padding,
  showGridLines,
}: {
  row: T;
  cells: ReportDatasetCell[];
  index: number;
  columns: ResolvedReportColumn<T>[];
  style: ResolvedReport<T>["style"];
  padding: number;
  showGridLines: boolean;
}): ReactElement {
  const isOdd = index % 2 === 1;
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: style.zebraStripes && isOdd ? ZEBRA_COLOR : undefined,
      }}
      wrap={false}
    >
      {columns.map((column, columnIndex) => {
        const cell = cells[columnIndex] ?? null;
        const ctx: ReportPdfCellContext<T> = {
          row,
          value: cell?.raw,
          formatted: cell?.formatted ?? "",
          column,
          style,
        };
        return (
          <View key={column.key} style={cellStyle(column, padding, showGridLines)}>
            {column.pdfRender ? (
              column.pdfRender(ctx)
            ) : (
              <Text style={{ fontSize: style.fontSize, textAlign: column.align }}>
                {ctx.formatted}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function AggregateRow<T>({
  columns,
  aggregate,
  label,
  style,
  padding,
  showGridLines,
}: {
  columns: ResolvedReportColumn<T>[];
  aggregate: (ReportDatasetCell | null)[];
  label: string;
  style: ResolvedReport<T>["style"];
  padding: number;
  showGridLines: boolean;
}): ReactElement {
  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: style.accentColor,
      }}
      wrap={false}
    >
      {columns.map((column, columnIndex) => {
        const cell = aggregate[columnIndex] ?? null;
        const text = cell ? cell.formatted : columnIndex === 0 ? label : "";
        return (
          <View key={column.key} style={cellStyle(column, padding, showGridLines)}>
            <Text style={{ fontSize: style.fontSize, fontWeight: "bold", textAlign: column.align }}>
              {text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ReportPdfTable<T>({
  resolved,
  rows,
  dataset,
}: ReportPdfTableProps<T>): ReactElement {
  const { style, visibleColumns: columns } = resolved;
  const padding = DENSITY_PADDING[style.density];
  const showGridLines = style.showGridLines;
  const groups = pairGroupsWithDataset(resolved, rows, dataset);

  let rowIndex = 0;
  function nextDataRow(row: T, cells: ReportDatasetCell[]): ReactElement {
    const element = (
      <DataRow
        key={rowIndex}
        row={row}
        cells={cells}
        index={rowIndex}
        columns={columns}
        style={style}
        padding={padding}
        showGridLines={showGridLines}
      />
    );
    rowIndex += 1;
    return element;
  }

  return (
    <View>
      {/* Cabeçalho de colunas: de propósito NÃO marcado como `fixed`. No react-pdf, `fixed`
          reancora o elemento no topo absoluto de CADA página (acima até do cabeçalho de
          branding do documento, que já é `fixed`), então marcar o header da tabela como `fixed`
          o empilharia por cima do cabeçalho do relatório em vez de repeti-lo logo acima da
          tabela. Repetir corretamente exigiria unificar os dois `fixed` num único bloco por
          página — fora do escopo do v1. Aceite: o header de colunas aparece só uma vez, no
          início da tabela (primeira página). */}
      <HeaderRow columns={columns} style={style} padding={padding} showGridLines={showGridLines} />

      {groups
        ? groups.map((group) => (
            <View key={group.key}>
              <View style={{ backgroundColor: GROUP_BG_COLOR, padding }} wrap={false}>
                <Text style={{ fontSize: style.fontSize, fontWeight: "bold" }}>{group.label}</Text>
              </View>
              {group.rows.map((item) => nextDataRow(item.row, item.cells))}
              {group.subtotal ? (
                <AggregateRow
                  columns={columns}
                  aggregate={group.subtotal}
                  label="Subtotal"
                  style={style}
                  padding={padding}
                  showGridLines={showGridLines}
                />
              ) : null}
            </View>
          ))
        : dataset.rows.map((item, index) => nextDataRow(rows[index], item.cells))}

      {dataset.total ? (
        <AggregateRow
          columns={columns}
          aggregate={dataset.total}
          label="Total"
          style={style}
          padding={padding}
          showGridLines={showGridLines}
        />
      ) : null}
    </View>
  );
}
