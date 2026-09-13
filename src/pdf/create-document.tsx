// create-document.tsx — peça central do entry /pdf: ponte entre o core (`resolveReport` +
// `buildReportDataset`) e os primitivos react-pdf. Usada tanto pelo render server
// (`render.ts`, via `renderToBuffer`/`renderToStream`) quanto, na fase 9, pelo preview client
// (`pdf(doc).toBlob()`). Ponto de extensão documentado do entry — os primitivos internos
// (`ReportPdfDocument`/`ReportPdfTable`/`ReportPdfSummary`) não são exportados no barrel.
import { Fragment, type ReactElement } from "react";
import { buildReportDataset } from "../core/dataset.js";
import { resolveReport } from "../core/resolve.js";
import type {
  ReportDataset,
  ReportRenderInput,
  ReportSectionContext,
  ResolvedReport,
} from "../core/types.js";
import { resolveMaxRowsPerBlock, type ReportPdfOptions } from "./options.js";
import { requiresContinuousPagination } from "./pagination-compatibility.js";
import { ReportPdfDocument } from "./primitives/pdf-document.js";
import { ReportPdfSummary } from "./primitives/pdf-summary.js";
import { ReportPdfTable } from "./primitives/pdf-table.js";
import { buildReportPdfTableBlocks, type ReportPdfTableBlock } from "./table-blocks.js";

export type PreparedReportPdf<T> = {
  resolved: ResolvedReport<T>;
  dataset: ReportDataset;
  blocks: ReportPdfTableBlock<T>[];
  generatedAt: Date;
  userName?: string;
  footerText?: string;
  beforeTable: ReactElement[];
  afterTable: ReactElement[];
  afterSummary: ReactElement[];
};

/**
 * Resolve `input` (`resolveReport`) e monta a árvore react-pdf completa do relatório:
 * `<ReportPdfDocument>` contém blocos de paginação limitados em A4/Letter. Cada bloco
 * pode ocupar várias páginas conforme a altura real das linhas. Sections `before-table`
 * aparecem no primeiro; `after-table`, sumário e `after-summary`, somente no último.
 *
 * `buildReportDataset` é chamado uma única vez aqui e repassado para a tabela e o sumário via
 * prop — evita recalcular células formatadas/subtotais/total duas vezes.
 */
export function createReportDocument<T>(
  input: ReportRenderInput<T>,
  options?: ReportPdfOptions,
): ReactElement {
  return createPreparedReportDocument(prepareReportPdf(input, options));
}

/** Preparação compartilhada: dados, seções e callbacks customizados são avaliados uma vez. */
export function prepareReportPdf<T>(
  input: ReportRenderInput<T>,
  options?: ReportPdfOptions,
): PreparedReportPdf<T> {
  const { definition, rows, globalConfig, view, overrides, userName } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const maxRowsPerBlock = resolveMaxRowsPerBlock(options);

  const resolved = resolveReport({ definition, globalConfig, view, overrides });
  const dataset = buildReportDataset(resolved, rows, { userName, generatedAt });
  const thermal = resolved.page.paperSize === "58mm" || resolved.page.paperSize === "80mm";

  const sectionCtx: ReportSectionContext<T> = { rows, resolved, generatedAt, userName };
  const beforeTable = resolved.sections
    .filter((section) => section.position === "before-table")
    .map((section) => <Fragment key={section.id}>{section.pdfRender(sectionCtx)}</Fragment>);
  const afterTable = resolved.sections
    .filter((section) => section.position === "after-table")
    .map((section) => <Fragment key={section.id}>{section.pdfRender(sectionCtx)}</Fragment>);
  const afterSummary = resolved.sections
    .filter((section) => section.position === "after-summary")
    .map((section) => <Fragment key={section.id}>{section.pdfRender(sectionCtx)}</Fragment>);

  let continuous = thermal || requiresContinuousPagination([beforeTable, afterTable, afterSummary]);
  const blocks = buildReportPdfTableBlocks(
    resolved,
    rows,
    dataset,
    continuous ? false : maxRowsPerBlock,
  );

  if (resolved.visibleColumns.some((column) => column.pdfRender)) {
    for (const block of blocks) {
      for (const entry of block.entries) {
        if (entry.kind !== "row") continue;
        entry.renderedCells = resolved.visibleColumns.map((column, index) => {
          if (!column.pdfRender) return undefined;
          const cell = entry.cells[index];
          const element = column.pdfRender({
            row: entry.row,
            value: cell?.raw,
            formatted: cell?.formatted ?? "",
            column,
            style: resolved.style,
          });
          continuous = continuous || requiresContinuousPagination(element);
          return element;
        });
      }
    }
  }

  return {
    resolved,
    dataset,
    blocks:
      continuous && blocks.length > 1
        ? [{ entries: blocks.flatMap((block) => block.entries) }]
        : blocks,
    generatedAt,
    userName,
    footerText: globalConfig?.footerText,
    beforeTable,
    afterTable,
    afterSummary,
  };
}

/** Constrói o documento completo ou um único bloco, sem repetir a preparação. */
export function createPreparedReportDocument<T>(
  report: PreparedReportPdf<T>,
  options: { blockIndex?: number; renderFooter?: boolean } = {},
): ReactElement {
  const {
    resolved,
    dataset,
    blocks,
    generatedAt,
    userName,
    footerText,
    beforeTable,
    afterTable,
    afterSummary,
  } = report;
  const selectedBlocks =
    options.blockIndex === undefined
      ? blocks.map((block, index) => ({ block, index }))
      : [{ block: blocks[options.blockIndex], index: options.blockIndex }];

  return (
    <ReportPdfDocument
      resolved={resolved}
      generatedAt={generatedAt}
      userName={userName}
      footerText={footerText}
      renderFooter={options.renderFooter}
      blocks={selectedBlocks.map(({ block, index }) => (
        <Fragment key={index}>
          {index === 0 ? beforeTable : null}
          <ReportPdfTable resolved={resolved} block={block} />
          {index === blocks.length - 1 ? (
            <>
              {afterTable}
              {dataset.summary.length > 0 ? (
                <ReportPdfSummary items={dataset.summary} style={resolved.style} />
              ) : null}
              {afterSummary}
            </>
          ) : null}
        </Fragment>
      ))}
    />
  );
}
