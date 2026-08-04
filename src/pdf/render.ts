// render.ts — renderiza um `ReportRenderInput` em PDF via @react-pdf/renderer, server-side.
import { renderToBuffer, renderToStream } from "@react-pdf/renderer";
import type { ReportRenderInput } from "../core/types.js";
import { createReportDocument } from "./create-document.js";

// `createReportDocument` retorna `ReactElement` genérico (contrato público do plano); os
// `render*` do react-pdf esperam `ReactElement<DocumentProps>`, um tipo não exportado por nome
// pelo pacote — extraído aqui via `Parameters` para não depender de conhecer seu nome interno.
type ReportPdfDocumentElement = Parameters<typeof renderToBuffer>[0];

/** Renderiza o relatório em um buffer de bytes do PDF — uso típico em route handlers do
 *  Next.js (`new Response(buffer)`). */
export async function renderReportToBuffer<T>(input: ReportRenderInput<T>): Promise<Uint8Array> {
  const document = createReportDocument(input) as ReportPdfDocumentElement;
  return renderToBuffer(document);
}

/** Renderiza o relatório como stream Node — útil para respostas HTTP com streaming. */
export async function renderReportToStream<T>(
  input: ReportRenderInput<T>,
): Promise<NodeJS.ReadableStream> {
  const document = createReportDocument(input) as ReportPdfDocumentElement;
  return renderToStream(document);
}
