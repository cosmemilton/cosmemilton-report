import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fileURLToPath } from "node:url";

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
  /** Bitmap opcional, usado para conferir preenchimentos e SVG no PDF emitido. */
  raster?: { width: number; height: number; scale: number; pixels: Uint8ClampedArray };
};

/** Lê o PDF emitido, incluindo texto e coordenadas de cada página física. */
export async function readPdf(
  bytes: Uint8Array,
  options: { rasterize?: boolean } = {},
): Promise<PdfPageContent[]> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: fileURLToPath(
      new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
    ),
  });
  const document = await task.promise;
  try {
    const pages: PdfPageContent[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let raster: PdfPageContent["raster"];
      if (options.rasterize) {
        const scale = 2;
        const imageViewport = page.getViewport({ scale });
        type CanvasTarget = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
        const factory = document.canvasFactory as {
          create(width: number, height: number): CanvasTarget;
          destroy(target: CanvasTarget): void;
        };
        const width = Math.ceil(imageViewport.width),
          height = Math.ceil(imageViewport.height);
        const target = factory.create(width, height);
        try {
          await page.render({
            canvas: target.canvas,
            canvasContext: target.context,
            viewport: imageViewport,
          }).promise;
          raster = {
            width,
            height,
            scale,
            pixels: target.context.getImageData(0, 0, width, height).data,
          };
        } finally {
          factory.destroy(target);
        }
      }
      pages.push({
        width: viewport.width,
        height: viewport.height,
        ...(raster ? { raster } : {}),
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
