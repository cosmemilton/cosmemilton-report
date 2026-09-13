import { groupRows } from "../core/groups.js";
import type { ReactElement } from "react";
import type { ReportDataset, ReportDatasetCell, ResolvedReport } from "../core/types.js";

type DataEntry<T> = {
  kind: "row";
  key: string;
  row: T;
  cells: ReportDatasetCell[];
  /** Resultado de pdfRender calculado uma vez, antes de particionar documentos. */
  renderedCells?: (ReactElement | undefined)[];
  /** Índice no relatório completo, usado para manter a zebra entre blocos e grupos. */
  index: number;
};

type GroupEntry = { kind: "group"; key: string; label: string };
type AggregateEntry = {
  kind: "aggregate";
  key: string;
  label: "Subtotal" | "Total";
  cells: (ReportDatasetCell | null)[];
};

export type ReportPdfTableEntry<T> = DataEntry<T> | GroupEntry | AggregateEntry;
export type ReportPdfTableBlock<T> = { entries: ReportPdfTableEntry<T>[] };

/**
 * Divide somente o fluxo visual. Células, subtotais e total vêm do dataset completo;
 * nenhuma definição ou soma é recalculada por bloco. As linhas originais chegam
 * intactas ao pdfRender. Um grupo pode atravessar blocos sem repetir rótulo/subtotal.
 */
export function buildReportPdfTableBlocks<T>(
  resolved: ResolvedReport<T>,
  rows: T[],
  dataset: ReportDataset,
  maxRowsPerBlock: number | false,
): ReportPdfTableBlock<T>[] {
  const blocks: ReportPdfTableBlock<T>[] = [{ entries: [] }];
  let block = blocks[0];
  let blockRowCount = 0;
  let rowIndex = 0;

  function prepareRow(): void {
    if (
      maxRowsPerBlock !== false &&
      resolved.visibleColumns.length > 0 &&
      blockRowCount >= maxRowsPerBlock
    ) {
      block = { entries: [] };
      blocks.push(block);
      blockRowCount = 0;
    }
  }

  function appendRow(row: T, cells: ReportDatasetCell[]): void {
    block.entries.push({ kind: "row", key: `row-${rowIndex}`, row, cells, index: rowIndex });
    rowIndex += 1;
    blockRowCount += 1;
  }

  if (resolved.group) {
    // O dataset não contém T. Repetir apenas o agrupamento puro recupera as referências
    // na mesma ordem; o rótulo já calculado no dataset não precisa ser executado de novo.
    const groups = groupRows(rows, { by: resolved.group.by });
    groups.forEach((group, groupIndex) => {
      const datasetGroup = dataset.groups?.[groupIndex];
      group.rows.forEach((row, index) => {
        prepareRow();
        if (index === 0) {
          block.entries.push({
            kind: "group",
            key: `group-${groupIndex}`,
            label: datasetGroup?.label ?? group.label,
          });
        }
        appendRow(row, datasetGroup?.rows[index]?.cells ?? []);
      });
      if (datasetGroup?.subtotal) {
        block.entries.push({
          kind: "aggregate",
          key: `subtotal-${groupIndex}`,
          label: "Subtotal",
          cells: datasetGroup.subtotal,
        });
      }
    });
  } else {
    dataset.rows.forEach((item, index) => {
      prepareRow();
      appendRow(rows[index], item.cells);
    });
  }

  if (dataset.total) {
    block.entries.push({
      kind: "aggregate",
      key: "total",
      label: "Total",
      cells: dataset.total,
    });
  }
  return blocks;
}
