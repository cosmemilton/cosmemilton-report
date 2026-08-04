import { describe, expect, it } from "vitest";
import { defaultReportGlobalConfig, defaultReportHeader, defaultReportStyle } from "./defaults.js";
import { parseReportDefinition, parseReportGlobalConfig, parseReportView } from "./parse.js";
import type { ReportView, SerializableReportDefinition } from "./types.js";

describe("parseReportGlobalConfig", () => {
  it("retorna o default completo quando raw não é objeto", () => {
    expect(parseReportGlobalConfig(null)).toEqual(defaultReportGlobalConfig);
    expect(parseReportGlobalConfig(undefined)).toEqual(defaultReportGlobalConfig);
    expect(parseReportGlobalConfig("banana")).toEqual(defaultReportGlobalConfig);
    expect(parseReportGlobalConfig(42)).toEqual(defaultReportGlobalConfig);
    expect(parseReportGlobalConfig([])).toEqual(defaultReportGlobalConfig);
  });

  it("valor inválido cai no default sem lançar (critério de aceite 1)", () => {
    expect(() =>
      parseReportGlobalConfig({ paperSize: "banana", marginTopMm: -5, showLogo: "sim" }),
    ).not.toThrow();

    const result = parseReportGlobalConfig({
      paperSize: "banana",
      marginTopMm: -5,
      showLogo: "sim",
    });
    expect(result.paperSize).toBe("A4");
    expect(result.marginTopMm).toBe(defaultReportGlobalConfig.marginTopMm);
    expect(result.showLogo).toBe(defaultReportGlobalConfig.showLogo);
  });

  it("aceita valores válidos e os aplica sobre o default", () => {
    const result = parseReportGlobalConfig({
      companyName: "Minha Empresa",
      paperSize: "Letter",
      orientation: "landscape",
      marginTopMm: 20,
      locale: "en-US",
      currency: "USD",
    });
    expect(result.companyName).toBe("Minha Empresa");
    expect(result.paperSize).toBe("Letter");
    expect(result.orientation).toBe("landscape");
    expect(result.marginTopMm).toBe(20);
    expect(result.locale).toBe("en-US");
    expect(result.currency).toBe("USD");
    // campos não informados continuam no default.
    expect(result.marginBottomMm).toBe(defaultReportGlobalConfig.marginBottomMm);
  });

  it("rejeita margens negativas ou não-finitas, mantendo o default", () => {
    const result = parseReportGlobalConfig({
      marginTopMm: -1,
      marginBottomMm: Number.NaN,
      marginLeftMm: Number.POSITIVE_INFINITY,
      marginRightMm: "10",
    });
    expect(result.marginTopMm).toBe(defaultReportGlobalConfig.marginTopMm);
    expect(result.marginBottomMm).toBe(defaultReportGlobalConfig.marginBottomMm);
    expect(result.marginLeftMm).toBe(defaultReportGlobalConfig.marginLeftMm);
    expect(result.marginRightMm).toBe(defaultReportGlobalConfig.marginRightMm);
  });

  it("aceita margem zero (limite >= 0)", () => {
    const result = parseReportGlobalConfig({ marginTopMm: 0 });
    expect(result.marginTopMm).toBe(0);
  });

  it("valida header e style campo a campo, preservando defaults nos campos inválidos", () => {
    const result = parseReportGlobalConfig({
      header: { title: "Relatório", showLogo: "não é boolean", showPageNumbers: false },
      style: { fontSize: -5, density: "gigante", zebraStripes: false },
    });
    expect(result.header.title).toBe("Relatório");
    expect(result.header.showLogo).toBe(defaultReportHeader.showLogo);
    expect(result.header.showPageNumbers).toBe(false);
    expect(result.style.fontSize).toBe(defaultReportStyle.fontSize);
    expect(result.style.density).toBe(defaultReportStyle.density);
    expect(result.style.zebraStripes).toBe(false);
  });

  it("ignora header/style que não são objeto", () => {
    const result = parseReportGlobalConfig({ header: "não é objeto", style: 123 });
    expect(result.header).toEqual(defaultReportHeader);
    expect(result.style).toEqual(defaultReportStyle);
  });
});

describe("parseReportView", () => {
  it("retorna null quando raw não é objeto", () => {
    expect(parseReportView(null)).toBeNull();
    expect(parseReportView("view")).toBeNull();
    expect(parseReportView([])).toBeNull();
  });

  it("retorna null sem slug (critério de aceite 2)", () => {
    expect(parseReportView({ id: "v1" })).toBeNull();
  });

  it("retorna null sem id", () => {
    expect(parseReportView({ slug: "vendas" })).toBeNull();
  });

  it("retorna null com id/slug vazios", () => {
    expect(parseReportView({ id: "", slug: "vendas" })).toBeNull();
    expect(parseReportView({ id: "v1", slug: "" })).toBeNull();
  });

  it("descarta entrada de coluna sem key, mantendo a view válida (critério de aceite 2)", () => {
    const result = parseReportView({
      id: "v1",
      slug: "vendas",
      columns: [{ header: "Sem key" }, { key: "total", header: "Total" }],
    });
    expect(result).not.toBeNull();
    expect(result?.columns).toEqual([{ key: "total", header: "Total" }]);
  });

  it("usa slug como name default quando name está ausente ou inválido", () => {
    expect(parseReportView({ id: "v1", slug: "vendas" })?.name).toBe("vendas");
    expect(parseReportView({ id: "v1", slug: "vendas", name: 123 })?.name).toBe("vendas");
    expect(parseReportView({ id: "v1", slug: "vendas", name: "Minha view" })?.name).toBe(
      "Minha view",
    );
  });

  it("coage isSystem/isDefault para boolean com default false", () => {
    expect(parseReportView({ id: "v1", slug: "vendas" })?.isSystem).toBe(false);
    expect(parseReportView({ id: "v1", slug: "vendas" })?.isDefault).toBe(false);
    expect(parseReportView({ id: "v1", slug: "vendas", isSystem: "sim" })?.isSystem).toBe(false);
    expect(parseReportView({ id: "v1", slug: "vendas", isSystem: true })?.isSystem).toBe(true);
  });

  it("faz round-trip fiel de uma view válida completa", () => {
    const original: ReportView = {
      id: "v1",
      slug: "vendas",
      name: "Minha view",
      isSystem: false,
      isDefault: true,
      columns: [
        {
          key: "total",
          header: "Total geral",
          width: "30%",
          align: "right",
          format: "currency",
          visible: true,
          sortOrder: 1,
        },
      ],
      header: { title: "Título", showLogo: false },
      style: { fontSize: 9, density: "compact" },
      summary: [{ label: "Total", sourceColumn: "total", operation: "sum", format: "currency" }],
      updatedAt: "2026-08-04T12:00:00.000Z",
    };
    expect(parseReportView(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });

  it("descarta formatos/alinhamentos inválidos nas colunas", () => {
    const result = parseReportView({
      id: "v1",
      slug: "vendas",
      columns: [{ key: "total", align: "diagonal", format: "banana" }],
    });
    expect(result?.columns).toEqual([{ key: "total" }]);
  });

  it("ignora summary/header/style/columns que não têm o shape esperado", () => {
    const result = parseReportView({
      id: "v1",
      slug: "vendas",
      columns: "não é array",
      header: "não é objeto",
      style: 42,
      summary: "não é array",
    });
    expect(result).not.toBeNull();
    expect(result?.columns).toBeUndefined();
    expect(result?.header).toBeUndefined();
    expect(result?.style).toBeUndefined();
    expect(result?.summary).toBeUndefined();
  });
});

describe("parseReportDefinition", () => {
  it("retorna null quando raw não é objeto", () => {
    expect(parseReportDefinition(null)).toBeNull();
    expect(parseReportDefinition("definicao")).toBeNull();
  });

  it("retorna null sem slug/name string não-vazia", () => {
    expect(
      parseReportDefinition({ name: "Vendas", columns: [{ key: "a", header: "A" }] }),
    ).toBeNull();
    expect(
      parseReportDefinition({ slug: "vendas", columns: [{ key: "a", header: "A" }] }),
    ).toBeNull();
    expect(
      parseReportDefinition({ slug: "", name: "Vendas", columns: [{ key: "a", header: "A" }] }),
    ).toBeNull();
  });

  it("retorna null com columns: [] (critério de aceite 3)", () => {
    expect(parseReportDefinition({ slug: "vendas", name: "Vendas", columns: [] })).toBeNull();
  });

  it("retorna null quando nenhuma coluna é válida", () => {
    expect(
      parseReportDefinition({
        slug: "vendas",
        name: "Vendas",
        columns: [{ key: "sem-header" }, { header: "sem-key" }],
      }),
    ).toBeNull();
  });

  it("um JSON válido é parseado para uma definição igual (round-trip)", () => {
    const original: SerializableReportDefinition = {
      slug: "vendas",
      name: "Relatório de Vendas",
      description: "Vendas do período",
      dataSource: "vendas",
      columns: [
        { key: "data", header: "Data", format: "date", width: "20%", visible: true, sortOrder: 0 },
        { key: "total", header: "Total", format: "currency", align: "right", sortOrder: 1 },
      ],
      summary: [
        { label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" },
      ],
      header: { title: "Vendas", showLogo: true },
      style: { fontSize: 8, zebraStripes: true },
      group: { by: "vendedor", showSubtotal: true },
    };
    const roundTripped = JSON.parse(JSON.stringify(original));
    expect(parseReportDefinition(roundTripped)).toEqual(original);
  });

  it("descarta campo pdfRender malicioso vindo do JSON (critério de aceite 3)", () => {
    const raw = {
      slug: "vendas",
      name: "Vendas",
      columns: [
        {
          key: "total",
          header: "Total",
          // "pdfRender" nunca deveria existir em JSON puro — simula uma tentativa de injetar
          // código serializado (string) tentando ser interpretado como função no consumo.
          pdfRender: "() => { throw new Error('nunca deveria rodar'); }",
        },
      ],
    };
    const result = parseReportDefinition(raw);
    expect(result).not.toBeNull();
    expect(result?.columns[0]).toEqual({ key: "total", header: "Total" });
    expect("pdfRender" in (result?.columns[0] ?? {})).toBe(false);
  });

  it("valida formats/aligns por Set, descartando valores desconhecidos", () => {
    const result = parseReportDefinition({
      slug: "vendas",
      name: "Vendas",
      columns: [{ key: "total", header: "Total", format: "banana", align: "diagonal" }],
    });
    expect(result?.columns[0]).toEqual({ key: "total", header: "Total" });
  });

  it("exige group.by como string; grupo inválido é descartado inteiro", () => {
    const semGroup = parseReportDefinition({
      slug: "vendas",
      name: "Vendas",
      columns: [{ key: "total", header: "Total" }],
      group: { by: { fn: "não é string" } },
    });
    expect(semGroup?.group).toBeUndefined();

    const comGroup = parseReportDefinition({
      slug: "vendas",
      name: "Vendas",
      columns: [{ key: "total", header: "Total" }],
      group: { by: "vendedor" },
    });
    expect(comGroup?.group).toEqual({ by: "vendedor" });
  });
});
