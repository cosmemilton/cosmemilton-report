import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfTextItem = {
  text: string;
  x: number;
  /** Distância do topo da página até a linha de base do texto, em pontos. */
  y: number;
  width: number;
  height: number;
};

export type PdfPageContent = {
  width: number;
  height: number;
  items: PdfTextItem[];
};

/** Lê o PDF emitido, incluindo texto e coordenadas de cada página física. */
export async function readPdf(bytes: Uint8Array): Promise<PdfPageContent[]> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const document = await task.promise;
  try {
    const pages: PdfPageContent[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      pages.push({
        width: viewport.width,
        height: viewport.height,
        items: content.items.flatMap((item) =>
          "str" in item && item.str.trim()
            ? [
                {
                  text: item.str,
                  x: item.transform[4],
                  y: viewport.height - item.transform[5],
                  width: item.width,
                  height: item.height,
                },
              ]
            : [],
        ),
      });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
