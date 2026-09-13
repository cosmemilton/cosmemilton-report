// render.ts — renderiza um `ReportRenderInput` em PDF via @react-pdf/renderer, server-side.
import { renderToBuffer, renderToStream } from "@react-pdf/renderer";
import type { PDFDocument } from "pdf-lib";
import type { ReportRenderInput } from "../core/types.js";
import {
  createPreparedReportDocument,
  prepareReportPdf,
  type PreparedReportPdf,
} from "./create-document.js";
import type { ReportPdfOptions } from "./options.js";
import { createReportFooterDocument } from "./primitives/pdf-document.js";
import { renderNativeReportToBuffer } from "./native-render.js";

// `createReportDocument` retorna `ReactElement` genérico (contrato público do plano); os
// `render*` do react-pdf esperam `ReactElement<DocumentProps>`, um tipo não exportado por nome
// pelo pacote — extraído aqui via `Parameters` para não depender de conhecer seu nome interno.
type ReportPdfDocumentElement = Parameters<typeof renderToBuffer>[0];

const FOOTER_PAGES_PER_BATCH = 50;

function copyMetadata(source: PDFDocument, target: PDFDocument): void {
  const title = source.getTitle();
  const author = source.getAuthor();
  const subject = source.getSubject();
  const keywords = source.getKeywords();
  const creator = source.getCreator();
  const producer = source.getProducer();
  const created = source.getCreationDate();
  const modified = source.getModificationDate();
  if (title !== undefined) target.setTitle(title);
  if (author !== undefined) target.setAuthor(author);
  if (subject !== undefined) target.setSubject(subject);
  if (keywords !== undefined) target.setKeywords([keywords]);
  if (creator !== undefined) target.setCreator(creator);
  if (producer !== undefined) target.setProducer(producer);
  if (created !== undefined) target.setCreationDate(created);
  if (modified !== undefined) target.setModificationDate(modified);
}

/** Mantém apenas um bloco de layout React/Yoga ativo; não cria uma árvore de todas as páginas. */
async function renderBlocks<T>(report: PreparedReportPdf<T>): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();

  for (let blockIndex = 0; blockIndex < report.blocks.length; blockIndex += 1) {
    const document = createPreparedReportDocument(report, {
      blockIndex,
      renderFooter: false,
    }) as ReportPdfDocumentElement;
    const bytes = await renderToBuffer(document);
    const source = await PDFDocument.load(bytes, { updateMetadata: false });
    if (blockIndex === 0) copyMetadata(source, merged);
    const copied = await merged.copyPages(source, source.getPageIndices());
    for (const page of copied) merged.addPage(page);
  }

  // A altura real já foi resolvida pelo renderer. Reusar o próprio rodapé React mantém
  // fonte customizada, Unicode, alinhamento e margens; não substitui a fonte por Helvetica.
  const pages = merged.getPages();
  for (let start = 0; start < pages.length; start += FOOTER_PAGES_PER_BATCH) {
    const batch = pages.slice(start, start + FOOTER_PAGES_PER_BATCH);
    const document = createReportFooterDocument(
      report.resolved,
      report.footerText,
      batch.map((page, index) => ({
        width: page.getWidth(),
        height: page.getHeight(),
        pageNumber: start + index + 1,
      })),
      pages.length,
    ) as ReportPdfDocumentElement;
    const bytes = await renderToBuffer(document);
    const overlay = await PDFDocument.load(bytes, { updateMetadata: false });
    for (let index = 0; index < batch.length; index += 1) {
      const footer = await merged.embedPage(overlay.getPage(index), {
        left: 0,
        bottom: 0,
        right: batch[index].getWidth(),
        top: batch[index].getHeight(),
      });
      batch[index].drawPage(footer, {
        x: 0,
        y: 0,
        xScale: 1,
        yScale: 1,
      });
    }
  }
  return merged.save({ addDefaultPage: false });
}

/** Renderiza PDF no servidor. Relatórios em blocos usam renderização sequencial e merge. */
export async function renderReportToBuffer<T>(
  input: ReportRenderInput<T>,
  options?: ReportPdfOptions,
): Promise<Uint8Array> {
  const report = prepareReportPdf(input, options);
  if (options?.engine !== "react-pdf" && options?.maxRowsPerBlock !== false) {
    const native = await renderNativeReportToBuffer(report);
    if (native) return native;
  }
  if (report.blocks.length > 1) return renderBlocks(report);
  const document = createPreparedReportDocument(report) as ReportPdfDocumentElement;
  return renderToBuffer(document);
}

/**
 * Retorna stream Node. Com blocos, a primeira saída ocorre após finalizar layout, merge
 * e numeração global; o stream transporta o PDF final, sem manter a árvore React inteira.
 */
export async function renderReportToStream<T>(
  input: ReportRenderInput<T>,
  options?: ReportPdfOptions,
): Promise<NodeJS.ReadableStream> {
  const report = prepareReportPdf(input, options);
  const native =
    options?.engine !== "react-pdf" && options?.maxRowsPerBlock !== false
      ? await renderNativeReportToBuffer(report)
      : null;
  if (native || report.blocks.length > 1) {
    const bytes = native ?? (await renderBlocks(report));
    // /pdf também expõe createReportDocument para o navegador. Preservar import nativo
    // somente nesta API Node evita que Vite/Webpack tentem empacotar o builtin no client.
    const nodeStreamModule = "node:stream";
    const { Readable }: typeof import("node:stream") = await import(
      /* webpackIgnore: true */ /* @vite-ignore */ nodeStreamModule
    );
    return Readable.from([bytes], { objectMode: false });
  }
  const document = createPreparedReportDocument(report) as ReportPdfDocumentElement;
  return renderToStream(document);
}
