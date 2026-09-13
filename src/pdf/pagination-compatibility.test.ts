// @vitest-environment node
import { createElement, Fragment, memo } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ReportDefinition } from "../core/types.js";
import { prepareReportPdf } from "./create-document.js";
import { requiresContinuousPagination } from "./pagination-compatibility.js";

type Row = { id: string };
const rows: Row[] = [{ id: "A" }, { id: "B" }, { id: "C" }];
function definition(overrides: Partial<ReportDefinition<Row>> = {}): ReportDefinition<Row> {
  return {
    slug: "compatibility",
    name: "Compatibilidade",
    columns: [{ key: "id", header: "Item" }],
    ...overrides,
  };
}

describe("compatibilidade da paginação isolada", () => {
  it("aceita árvores de primitivas estáticas, fragments e links externos", () => {
    expect(
      requiresContinuousPagination([
        null,
        false,
        "Texto",
        123,
        createElement(
          Fragment,
          null,
          createElement(
            "VIEW",
            null,
            createElement("TEXT", null, "Conteúdo"),
            createElement("LINK", { src: "https://example.com" }, "Site"),
          ),
        ),
      ]),
    ).toBe(false);
  });

  it("detecta fixed aninhado sem desmontar seus pais", () => {
    expect(
      requiresContinuousPagination(
        createElement(
          Fragment,
          null,
          createElement(
            "VIEW",
            { style: { padding: 8 } },
            createElement("TEXT", { fixed: true }, "Marca"),
          ),
        ),
      ),
    ).toBe(true);
  });

  it("não executa componentes opacos ou callbacks de renderização dinâmica", () => {
    const component = vi.fn(() => createElement("TEXT", { fixed: true }, "Marca"));
    const render = vi.fn(() => "Página");
    expect(requiresContinuousPagination(createElement(component))).toBe(true);
    expect(requiresContinuousPagination(createElement(memo(component)))).toBe(true);
    expect(requiresContinuousPagination(createElement("TEXT", { render }))).toBe(true);
    expect(component).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it("preserva links, destinos e bookmarks internos no mesmo documento", () => {
    for (const props of [{ src: "#fim" }, { href: "#fim" }, { id: "fim" }, { bookmark: "Fim" }]) {
      expect(
        requiresContinuousPagination(
          createElement<{
            src?: string;
            href?: string;
            id?: string;
            bookmark?: string;
          }>("TEXT", props, "Conteúdo"),
        ),
      ).toBe(true);
    }
  });

  it("não consome um iterador que só deve ser avaliado pelo React", () => {
    const produce = vi.fn();
    function* children() {
      produce();
      yield createElement("TEXT", { fixed: true }, "Marca");
    }
    expect(requiresContinuousPagination(createElement("VIEW", null, children()))).toBe(true);
    expect(produce).not.toHaveBeenCalled();
  });

  it("calcula seções uma vez e mantém fluxo contínuo para componente opaco", () => {
    const component = vi.fn(() => createElement("TEXT", { fixed: true }, "Marca"));
    const section = vi.fn(() => createElement(component));
    const prepared = prepareReportPdf(
      {
        definition: definition({
          sections: [{ id: "marca", position: "before-table", pdfRender: section }],
        }),
        rows,
      },
      { maxRowsPerBlock: 1 },
    );
    expect(prepared.blocks).toHaveLength(1);
    expect(section).toHaveBeenCalledTimes(1);
    expect(component).not.toHaveBeenCalled();
  });

  it("avalia células uma vez com a linha original e detecta dependência de página global", () => {
    const render = vi.fn(() => "Página");
    const cell = vi.fn(({ row }: { row: Row }) => createElement("TEXT", { render }, row.id));
    const prepared = prepareReportPdf(
      {
        definition: definition({ columns: [{ key: "id", header: "Item", pdfRender: cell }] }),
        rows,
      },
      { maxRowsPerBlock: 1 },
    );
    expect(prepared.blocks).toHaveLength(1);
    expect(cell).toHaveBeenCalledTimes(3);
    cell.mock.calls.forEach(([ctx], index) => expect(ctx.row).toBe(rows[index]));
    const entries = prepared.blocks[0].entries.filter((entry) => entry.kind === "row");
    entries.forEach((entry, index) => {
      expect(entry.renderedCells?.[0]).toBe(cell.mock.results[index].value);
    });
    expect(render).not.toHaveBeenCalled();
  });

  it("não cria páginas extras quando todas as colunas estão ocultas", () => {
    const prepared = prepareReportPdf(
      {
        definition: definition(),
        rows,
        view: {
          id: "hidden",
          slug: "compatibility",
          name: "Ocultas",
          isSystem: false,
          isDefault: false,
          columns: [{ key: "id", visible: false }],
        },
      },
      { maxRowsPerBlock: 1 },
    );
    expect(prepared.resolved.visibleColumns).toHaveLength(0);
    expect(prepared.blocks).toHaveLength(1);
  });

  it("considera o papel resolvido depois dos overrides", () => {
    const thermal = prepareReportPdf(
      {
        definition: definition(),
        rows,
        globalConfig: { paperSize: "A4" },
        overrides: { paperSize: "80mm" },
      },
      { maxRowsPerBlock: 1 },
    );
    expect(thermal.blocks).toHaveLength(1);
    const sheet = prepareReportPdf(
      {
        definition: definition(),
        rows,
        globalConfig: { paperSize: "80mm" },
        overrides: { paperSize: "Letter" },
      },
      { maxRowsPerBlock: 1 },
    );
    expect(sheet.blocks).toHaveLength(3);
  });
});
