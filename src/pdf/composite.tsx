import { Document, renderToBuffer } from "@react-pdf/renderer";
import { Fragment, type ReactElement } from "react";
import type { ReportRenderInput } from "../core/types.js";
import {
  createPreparedReportDocument,
  prepareReportPdf,
  type PreparedReportPdf,
} from "./create-document.js";
import { type ReportPdfOptions, resolveMaxRowsPerBlock } from "./options.js";
import { requiresContinuousPagination } from "./pagination-compatibility.js";
import {
  applyPreparedReportFooters,
  copyMetadata,
  renderPreparedReportWithoutFooter,
} from "./render.js";

/** Entradas heterogêneas, em ordem; cada relatório inicia uma nova página. */
export type ReportCompositeInputs<T extends readonly unknown[]> = {
  [K in keyof T]: ReportRenderInput<T[K]>;
};
export type ReportCompositePdfOptions = Pick<ReportPdfOptions, "engine" | "maxRowsPerBlock">;

function prepare<T extends readonly unknown[]>(
  inputs: ReportCompositeInputs<T>,
  options?: ReportCompositePdfOptions,
): PreparedReportPdf<T[number]>[] {
  resolveMaxRowsPerBlock(options);
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new RangeError("O documento composto requer pelo menos um relatório");
  }
  const reports = inputs.map((input) => prepareReportPdf(input, options));
  if (reports.some((report) => !["A4", "Letter"].includes(report.resolved.page.paperSize))) {
    throw new RangeError("Documentos compostos requerem papel A4 ou Letter");
  }
  return reports;
}

function continuous<T>(report: PreparedReportPdf<T>): boolean {
  return (
    requiresContinuousPagination([report.beforeTable, report.afterTable, report.afterSummary]) ||
    report.blocks.some((block) =>
      block.entries.some(
        (entry) => entry.kind === "row" && requiresContinuousPagination(entry.renderedCells),
      ),
    )
  );
}

function document<T>(reports: PreparedReportPdf<T>[]): ReactElement {
  return (
    <Document title={reports[0].resolved.title}>
      {reports.map((report, index) => (
        <Fragment key={index}>
          {createPreparedReportDocument(report, { wrapDocument: false })}
        </Fragment>
      ))}
    </Document>
  );
}

/** Árvore React pública: tabelas, cabeçalhos e rodapés compartilham o Document. */
export function createCompositeReportDocument<T extends readonly unknown[]>(
  inputs: ReportCompositeInputs<T>,
  options?: ReportCompositePdfOptions,
): ReactElement {
  return document(prepare(inputs, options));
}

/**
 * Documento único. Reutiliza os motores e a paginação das tabelas existentes;
 * aplica os rodapés de cada parte com uma numeração física global.
 * Conteúdo React dependente do documento inteiro mantém uma árvore contínua.
 */
export async function renderCompositeReportToBuffer<T extends readonly unknown[]>(
  inputs: ReportCompositeInputs<T>,
  options?: ReportCompositePdfOptions,
): Promise<Uint8Array> {
  const reports = prepare(inputs, options);
  if (reports.some(continuous)) {
    return renderToBuffer(document(reports) as Parameters<typeof renderToBuffer>[0]);
  }
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  const ranges: { report: PreparedReportPdf<T[number]>; offset: number; count: number }[] = [];
  for (const report of reports) {
    const bytes = await renderPreparedReportWithoutFooter(report, options);
    const source = await PDFDocument.load(bytes, { updateMetadata: false });
    if (ranges.length === 0) copyMetadata(source, merged);
    const offset = merged.getPageCount();
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) merged.addPage(page);
    ranges.push({ report, offset, count: copied.length });
  }
  for (const { report, offset, count } of ranges) {
    await applyPreparedReportFooters(merged, report, offset, count);
  }
  return merged.save({ addDefaultPage: false });
}

/** Stream do PDF final; as duas APIs de servidor compartilham o mesmo contrato. */
export async function renderCompositeReportToStream<T extends readonly unknown[]>(
  inputs: ReportCompositeInputs<T>,
  options?: ReportCompositePdfOptions,
): Promise<NodeJS.ReadableStream> {
  const bytes = await renderCompositeReportToBuffer(inputs, options);
  const nodeStreamModule = "node:stream";
  const { Readable }: typeof import("node:stream") = await import(
    /* webpackIgnore: true */ /* @vite-ignore */ nodeStreamModule
  );
  return Readable.from([bytes], { objectMode: false });
}
