import { describe, expect, it } from "vitest";
import { resolveReport } from "./resolve.js";
import type { ReportDefinition, ReportView, SerializableReportDefinition } from "./types.js";

type Venda = { data: string; cliente: string; total: number };

const definition: ReportDefinition<Venda> = {
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date", width: "20%" },
    { key: "cliente", header: "Cliente", width: "50%" },
    { key: "total", header: "Total", format: "currency", width: "30%" },
  ],
  summary: [{ label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" }],
  header: { title: "Título da definição", subtitle: "Subtítulo da definição" },
};

describe("resolveReport", () => {
  it("usa o nome da definição como título quando nada define header.title", () => {
    const resolved = resolveReport({ definition: { ...definition, header: undefined } });
    expect(resolved.title).toBe(definition.name);
  });

  it("view com header.title sobrepõe a definição", () => {
    const view: ReportView = {
      id: "system:vendas",
      slug: "vendas",
      name: "Padrão",
      isSystem: true,
      isDefault: true,
      header: { title: "Título da view" },
    };

    const resolved = resolveReport({ definition, view });
    expect(resolved.title).toBe("Título da view");
    // subtítulo não foi definido na view -> herda da definição.
    expect(resolved.subtitle).toBe("Subtítulo da definição");
  });

  it("campo undefined herda da camada anterior (subtitle não sobrescrito pela view)", () => {
    const view: ReportView = {
      id: "system:vendas",
      slug: "vendas",
      name: "Padrão",
      isSystem: true,
      isDefault: true,
      header: { title: "Só o título" },
    };
    const resolved = resolveReport({ definition, view });
    expect(resolved.header.subtitle).toBe("Subtítulo da definição");
    expect(resolved.header.showLogo).toBe(true); // default herdado (definição não define)
  });

  it("orientation do globalConfig vale quando definição/view não a definem", () => {
    const resolved = resolveReport({
      definition,
      globalConfig: { orientation: "landscape" },
    });
    expect(resolved.page.orientation).toBe("landscape");
  });

  it("overrides ganham de tudo (globalConfig, definição e view)", () => {
    const view: ReportView = {
      id: "system:vendas",
      slug: "vendas",
      name: "Padrão",
      isSystem: true,
      isDefault: true,
      header: { title: "Título da view" },
    };

    const resolved = resolveReport({
      definition,
      globalConfig: { orientation: "landscape" },
      view,
      overrides: { title: "Título final", orientation: "portrait" },
    });

    expect(resolved.title).toBe("Título final");
    expect(resolved.page.orientation).toBe("portrait");
  });

  it("summary da view substitui (não mescla) o da definição quando presente", () => {
    const view: ReportView = {
      id: "system:vendas",
      slug: "vendas",
      name: "Padrão",
      isSystem: true,
      isDefault: true,
      summary: [{ label: "Contagem", sourceColumn: "*", operation: "count" }],
    };

    const resolved = resolveReport({ definition, view });
    expect(resolved.summary).toEqual([
      { label: "Contagem", sourceColumn: "*", operation: "count" },
    ]);
  });

  it("summary da definição é usado quando a view não define summary", () => {
    const view: ReportView = {
      id: "system:vendas",
      slug: "vendas",
      name: "Padrão",
      isSystem: true,
      isDefault: true,
    };

    const resolved = resolveReport({ definition, view });
    expect(resolved.summary).toEqual(definition.summary);
  });

  it("aceita uma SerializableReportDefinition (JSON puro) sem cast e resolve normalmente", () => {
    const serializable: SerializableReportDefinition = {
      slug: "clientes",
      name: "Relatório de Clientes",
      columns: [
        { key: "nome", header: "Nome", width: "60%" },
        { key: "cidade", header: "Cidade", width: "40%" },
      ],
      summary: [{ label: "Total", sourceColumn: "*", operation: "count" }],
    };

    const resolved = resolveReport({ definition: serializable });

    expect(resolved.slug).toBe("clientes");
    expect(resolved.title).toBe("Relatório de Clientes");
    expect(resolved.visibleColumns.map((c) => c.key)).toEqual(["nome", "cidade"]);
  });
});
