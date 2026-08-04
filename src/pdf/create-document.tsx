// create-document.tsx — peça central do entry /pdf: ponte entre o core (`resolveReport` +
// `buildReportDataset`) e os primitivos react-pdf. Usada tanto pelo render server
// (`render.ts`, via `renderToBuffer`/`renderToStream`) quanto, na fase 9, pelo preview client
// (`pdf(doc).toBlob()`). Ponto de extensão documentado do entry — os primitivos internos
// (`ReportPdfDocument`/`ReportPdfTable`/`ReportPdfSummary`) não são exportados no barrel.
import type { ReactElement } from "react";
import { buildReportDataset } from "../core/dataset.js";
import { resolveReport } from "../core/resolve.js";
import type { ReportRenderInput, ReportSectionContext } from "../core/types.js";
import { ReportPdfDocument } from "./primitives/pdf-document.js";
import { ReportPdfSummary } from "./primitives/pdf-summary.js";
import { ReportPdfTable } from "./primitives/pdf-table.js";

/**
 * Resolve `input` (`resolveReport`) e monta a árvore react-pdf completa do relatório:
 * `<ReportPdfDocument>` (página/cabeçalho/rodapé) envolvendo, em ordem, as sections
 * `before-table`, a `<ReportPdfTable>`, as sections `after-table`, a `<ReportPdfSummary>`
 * (só quando há itens de sumário) e as sections `after-summary`.
 *
 * `buildReportDataset` é chamado uma única vez aqui e repassado para a tabela e o sumário via
 * prop — evita recalcular células formatadas/subtotais/total duas vezes.
 */
export function createReportDocument<T>(input: ReportRenderInput<T>): ReactElement {
  const { definition, rows, globalConfig, view, overrides, userName } = input;
  const generatedAt = input.generatedAt ?? new Date();

  const resolved = resolveReport({ definition, globalConfig, view, overrides });
  const dataset = buildReportDataset(resolved, rows, { userName, generatedAt });

  const sectionCtx: ReportSectionContext<T> = { rows, resolved, generatedAt, userName };
  const beforeTable = resolved.sections
    .filter((section) => section.position === "before-table")
    .map((section) => section.pdfRender(sectionCtx));
  const afterTable = resolved.sections
    .filter((section) => section.position === "after-table")
    .map((section) => section.pdfRender(sectionCtx));
  const afterSummary = resolved.sections
    .filter((section) => section.position === "after-summary")
    .map((section) => section.pdfRender(sectionCtx));

  return (
    <ReportPdfDocument
      resolved={resolved}
      generatedAt={generatedAt}
      userName={userName}
      footerText={globalConfig?.footerText}
    >
      {beforeTable}
      <ReportPdfTable resolved={resolved} rows={rows} dataset={dataset} />
      {afterTable}
      {dataset.summary.length > 0 ? (
        <ReportPdfSummary items={dataset.summary} style={resolved.style} />
      ) : null}
      {afterSummary}
    </ReportPdfDocument>
  );
}
