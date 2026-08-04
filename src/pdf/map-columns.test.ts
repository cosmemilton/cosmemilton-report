import { describe, expect, it } from "vitest";
import { mmToPt, paperSizeToReactPdf, widthPct } from "./map-columns.js";

describe("mmToPt", () => {
  it("converte milímetros em pontos (fator 2.834645669)", () => {
    expect(mmToPt(10)).toBeCloseTo(28.35, 1);
    expect(mmToPt(0)).toBe(0);
  });
});

describe("widthPct", () => {
  it("formata um percentual como string de largura do react-pdf, com 2 casas decimais", () => {
    expect(widthPct(42.5)).toBe("42.5%");
    expect(widthPct(33.333333333333336)).toBe("33.33%");
    expect(widthPct(100)).toBe("100%");
  });
});

describe("paperSizeToReactPdf", () => {
  it("mapeia A4 e Letter para os literais aceitos por <Page size>", () => {
    expect(paperSizeToReactPdf("A4")).toBe("A4");
    expect(paperSizeToReactPdf("Letter")).toBe("LETTER");
  });
});
