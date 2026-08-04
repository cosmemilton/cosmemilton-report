import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadReportFile } from "./download.js";

// jsdom não implementa `URL.createObjectURL`/`revokeObjectURL` — mockados diretamente no
// construtor global (preservando o resto de `URL` intacto) a cada teste.
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.spyOn>;

/** Captura o `<a>` criado por `downloadBlob` via spy em `document.createElement` (chama através
 *  para o `createElement` real — evita mexer em `appendChild`/`removeChild`, que continuam
 *  operando normalmente sobre o DOM real). */
function captureAnchor(run: () => void): HTMLAnchorElement {
  const createElementSpy = vi.spyOn(document, "createElement");
  run();
  const anchorCall = createElementSpy.mock.results.find(
    (result) => (result.value as HTMLElement).tagName === "A",
  );
  createElementSpy.mockRestore();
  if (!anchorCall) {
    throw new Error("Nenhum <a> foi criado.");
  }
  return anchorCall.value as HTMLAnchorElement;
}

beforeEach(() => {
  createObjectURL = vi.fn(() => "blob:mock-url");
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  clickSpy.mockRestore();
  vi.restoreAllMocks();
});

describe("downloadBlob", () => {
  it("cria um <a> com o objectURL do blob, clica nele e revoga a URL", () => {
    const blob = new Blob(["conteudo"], { type: "text/plain" });
    downloadBlob(blob, "arquivo.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("define o atributo download com o fileName informado e remove o <a> do DOM depois", () => {
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    const anchor = captureAnchor(() => downloadBlob(new Blob(["x"]), "meu-arquivo.csv"));

    expect(anchor.download).toBe("meu-arquivo.csv");
    expect(anchor.isConnected).toBe(false);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
  });
});

describe("downloadReportFile", () => {
  it("monta um Blob com o MIME de reportMimeTypes e baixa via downloadBlob", async () => {
    const bom = String.fromCharCode(0xfeff);
    downloadReportFile(`${bom}Nome;Total\r\nAna;100`, "relatorio", "csv");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv; charset=utf-8");

    // `Blob.text()` decodifica via TextDecoder, que por padrão DESCARTA um BOM inicial (spec
    // Encoding) — para confirmar que o BOM realmente foi escrito nos bytes do Blob, lemos o
    // ArrayBuffer bruto e conferimos os 3 primeiros bytes (EF BB BF, BOM UTF-8).
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const withoutBom = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(withoutBom).toBe(`${bom}Nome;Total\r\nAna;100`);
  });

  it("anexa a extensão do formato quando o fileName ainda não tem", () => {
    const anchor = captureAnchor(() => downloadReportFile("[]", "meu-relatorio", "json"));
    expect(anchor.download).toBe("meu-relatorio.json");
  });

  it("não duplica a extensão quando o fileName já termina com ela", () => {
    const anchor = captureAnchor(() => downloadReportFile("[]", "meu-relatorio.json", "json"));
    expect(anchor.download).toBe("meu-relatorio.json");
  });

  it("aceita bytes (Uint8Array) além de string", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 fake");
    downloadReportFile(bytes, "relatorio", "pdf");

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    expect(await blob.text()).toBe("%PDF-1.4 fake");
  });
});
