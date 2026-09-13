// pdf-table.tsx — tabela do relatório: cabeçalho de colunas, linhas (zebra/gridlines/densidade/
// alinhamento conforme `resolved.style`), grupos com subtotal e total geral.
// Componente interno: não é exportado no barrel `src/pdf.ts`.
//
// Recebe um bloco do fluxo visual, com referências às linhas originais e às células do
// dataset completo. A paginação não recalcula agrupamentos, subtotais nem totais.
import { Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ReportDatasetCell, ResolvedReport, ResolvedReportColumn } from "../../core/types.js";
import { widthPct } from "../map-columns.js";
import type { ReportPdfTableBlock } from "../table-blocks.js";

export type ReportPdfTableProps<T> = {
  resolved: ResolvedReport<T>;
  block: ReportPdfTableBlock<T>;
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
      fixed
      wrap={false}
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
  cells,
  renderedCells,
  index,
  columns,
  style,
  padding,
  showGridLines,
}: {
  cells: ReportDatasetCell[];
  renderedCells?: (ReactElement | undefined)[];
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
        return (
          <View key={column.key} style={cellStyle(column, padding, showGridLines)}>
            {column.pdfRender ? (
              (renderedCells?.[columnIndex] ?? null)
            ) : (
              <Text style={{ fontSize: style.fontSize, textAlign: column.align }}>
                {cell?.formatted ?? ""}
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

export function ReportPdfTable<T>({ resolved, block }: ReportPdfTableProps<T>): ReactElement {
  const { style, visibleColumns: columns } = resolved;
  const padding = DENSITY_PADDING[style.density];
  const showGridLines = style.showGridLines;

  return (
    <View>
      {/* `fixed` permanece no fluxo da tabela e é copiado quando ela continua em outra
          página. Sem posicionamento absoluto, a moldura do relatório reserva seu espaço
          acima dele; sections fora da tabela não recebem cabeçalhos de coluna. */}
      <HeaderRow columns={columns} style={style} padding={padding} showGridLines={showGridLines} />

      {block.entries.map((entry) => {
        if (entry.kind === "group") {
          return (
            <View key={entry.key} style={{ backgroundColor: GROUP_BG_COLOR, padding }} wrap={false}>
              <Text style={{ fontSize: style.fontSize, fontWeight: "bold" }}>{entry.label}</Text>
            </View>
          );
        }
        if (entry.kind === "aggregate") {
          return (
            <AggregateRow
              key={entry.key}
              columns={columns}
              aggregate={entry.cells}
              label={entry.label}
              style={style}
              padding={padding}
              showGridLines={showGridLines}
            />
          );
        }
        return (
          <DataRow
            key={entry.key}
            cells={entry.cells}
            renderedCells={entry.renderedCells}
            index={entry.index}
            columns={columns}
            style={style}
            padding={padding}
            showGridLines={showGridLines}
          />
        );
      })}
    </View>
  );
}
