"use client";

// download.ts — dispara o download de um arquivo no navegador a partir de um Blob (ou de bytes/
// texto já serializados), sem depender de nenhum framework: cria um <a download> temporário com
// objectURL, clica nele e revoga o objectURL logo em seguida.
import type { ReportOutputFormat } from "../core/types.js";
import { reportMimeTypes } from "../next/report-response.js";

/**
 * Dispara o download de `data` (um `Blob` já pronto) como `fileName`. Cria um `<a>` fora da
 * tela, dispara `click()` e o remove do DOM na sequência, revogando o `objectURL` criado — o
 * padrão recomendado para download client-side sem navegar a página.
 */
export function downloadBlob(data: Blob, fileName: string): void {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Garante que `fileName` termine com a extensão de `format` (ex.: "relatorio" + "pdf" →
 *  "relatorio.pdf"; "relatorio.pdf" + "pdf" → inalterado, sem duplicar a extensão). */
function ensureExtension(fileName: string, format: ReportOutputFormat): string {
  const suffix = `.${format}`;
  return fileName.toLowerCase().endsWith(suffix) ? fileName : `${fileName}${suffix}`;
}

/**
 * Monta um `Blob` a partir do corpo já serializado de um relatório (bytes ou texto) usando o
 * MIME correto de `format` (ver `reportMimeTypes`), anexa a extensão ao `fileName` quando ainda
 * não estiver presente e delega o download a `downloadBlob`.
 */
export function downloadReportFile(
  data: Uint8Array | string,
  fileName: string,
  format: ReportOutputFormat,
): void {
  // `@types/node` declara seu próprio `Uint8Array<ArrayBufferLike>` (via `undici-types`), que
  // conflita estruturalmente com o `Uint8Array` do lib "DOM" esperado por `BlobPart` — mesmo
  // atrito de tipos já visto no `Buffer`/`LoadArg` de `xlsx/export-xlsx.test.ts` e no `BodyInit`
  // de `next/report-response.ts`. Em runtime é só um `Uint8Array`/`string` normal, aceito direto
  // pelo `Blob`.
  const blob = new Blob([data as unknown as BlobPart], { type: reportMimeTypes[format] });
  downloadBlob(blob, ensureExtension(fileName, format));
}
