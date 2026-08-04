// @vitest-environment node
// exceljs faz I/O binário (zip) — rodar sob jsdom não traria benefício e só arrisca
// incompatibilidade; ver o mesmo racional em src/pdf/render.test.tsx.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { ReportColumn, ReportDefinition, ReportView } from "../core/types.js";
import { exportReportToXlsx } from "./export-xlsx.js";

type Venda = { vendedor: string; quantidade: number; preco: number; dataVenda: Date };

const baseColumns: ReportColumn<Venda>[] = [
  { key: "vendedor", header: "Vendedor" },
  { key: "quantidade", header: "Qtd", format: "integer" },
  { key: "preco", header: "Preço", format: "currency" },
  { key: "dataVenda", header: "Data", format: "date" },
];

const rows: Venda[] = [
  { vendedor: "Ana", quantidade: 2, preco: 150.5, dataVenda: new Date(2026, 0, 15) },
  { vendedor: "Ana", quantidade: 1, preco: 200, dataVenda: new Date(2026, 0, 20) },
  { vendedor: "Bruno", quantidade: 5, preco: 80, dataVenda: new Date(2026, 1, 1) },
];

function definition(overrides?: Partial<ReportDefinition<Venda>>): ReportDefinition<Venda> {
  return {
    slug: "vendas",
    name: "Relatório de Vendas",
    columns: baseColumns,
    ...overrides,
  };
}

// exceljs declara seu próprio `Buffer` ambiente local (`declare interface Buffer extends
// ArrayBuffer {}`, não exportado) para tipar `load()` — incompatível, estruturalmente, com o
// `Buffer` global do @types/node moderno (genérico, `slice()` retorna `Buffer` em vez de
// `ArrayBuffer`). `LoadArg` extrai o tipo real do parâmetro sem precisar nomeá-lo; o cast via
// `unknown` é só para o type-checker — em runtime é um `Buffer` do Node normal.
type LoadArg = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

/** Relê o buffer gerado com um `Workbook` novo — prova de que o arquivo é um XLSX válido de
 *  verdade, não só bytes que "parecem" um zip. */
async function reload(buffer: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer) as unknown as LoadArg);
  return workbook;
}

/** `row.values` do exceljs é um array esparso 1-indexado (índice 0 vazio) — normaliza para um
 *  array 0-indexado do tamanho de `columnCount`. */
function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): ExcelJS.CellValue[] {
  const row = sheet.getRow(rowNumber);
  return Array.from({ length: sheet.columnCount }, (_, i) => row.getCell(i + 1).value);
}

describe("exportReportToXlsx", () => {
  it("gera um XLSX relegível com a sheet e os headers na linha 1", async () => {
    const buffer = await exportReportToXlsx({ definition: definition(), rows });
    const workbook = await reload(buffer);

    expect(workbook.worksheets).toHaveLength(1);
    const sheet = workbook.worksheets[0];
    expect(rowValues(sheet, 1)).toEqual(["Vendedor", "Qtd", "Preço", "Data"]);
  });

  it("célula de coluna currency é number e numFmt contém R$", async () => {
    const buffer = await exportReportToXlsx({ definition: definition(), rows });
    const sheet = (await reload(buffer)).worksheets[0];

    const cell = sheet.getRow(2).getCell(3); // Preço
    expect(typeof cell.value).toBe("number");
    expect(cell.value).toBe(150.5);
    expect(cell.numFmt).toContain("R$");
  });

  it("célula de coluna date é Date com numFmt dd/mm/yyyy", async () => {
    const buffer = await exportReportToXlsx({ definition: definition(), rows });
    const sheet = (await reload(buffer)).worksheets[0];

    const cell = sheet.getRow(2).getCell(4); // Data
    expect(cell.value).toBeInstanceOf(Date);
    expect(cell.numFmt).toBe("dd/mm/yyyy");
  });

  it("com group + showSubtotal: linha Subtotal, Total geral ao final, summary após linha em branco", async () => {
    const def = definition({
      group: { by: "vendedor", showSubtotal: true },
      summary: [
        { label: "Total geral", sourceColumn: "preco", operation: "sum", format: "currency" },
      ],
    });
    const buffer = await exportReportToXlsx({ definition: def, rows });
    const sheet = (await reload(buffer)).worksheets[0];

    let subtotalRowNumber: number | undefined;
    let totalRowNumber: number | undefined;
    let summaryRowNumber: number | undefined;

    for (let r = 1; r <= sheet.rowCount; r += 1) {
      const first = sheet.getRow(r).getCell(1).value;
      if (first === "Subtotal" && subtotalRowNumber === undefined) {
        subtotalRowNumber = r;
      }
      if (first === "Total") {
        totalRowNumber = r;
      }
      if (first === "Total geral") {
        summaryRowNumber = r;
      }
    }

    expect(subtotalRowNumber).toBeDefined();
    expect(sheet.getRow(subtotalRowNumber!).getCell(3).value).toBe(350.5); // preço subtotal Ana: 150.5+200

    expect(totalRowNumber).toBeDefined();
    expect(sheet.getRow(totalRowNumber!).getCell(3).value).toBe(430.5); // 150.5+200+80

    expect(summaryRowNumber).toBeDefined();
    // Deve haver ao menos uma linha (a linha em branco) entre o Total geral e o início do
    // sumário — não checamos o conteúdo dessa linha diretamente porque a forma como o exceljs
    // (re)serializa uma linha totalmente vazia é um detalhe de implementação da lib, não do
    // nosso contrato.
    expect(summaryRowNumber!).toBeGreaterThanOrEqual(totalRowNumber! + 2);
    expect(sheet.getRow(summaryRowNumber!).getCell(2).value).toBe(430.5);
  });

  it("coluna oculta (visible: false na view) não aparece", async () => {
    const view: ReportView = {
      id: "custom",
      slug: "vendas",
      name: "Custom",
      isSystem: false,
      isDefault: false,
      columns: [{ key: "quantidade", visible: false }],
    };
    const buffer = await exportReportToXlsx({ definition: definition(), rows, view });
    const sheet = (await reload(buffer)).worksheets[0];

    expect(rowValues(sheet, 1)).toEqual(["Vendedor", "Preço", "Data"]);
  });

  it("sheetName custom é respeitado", async () => {
    const buffer = await exportReportToXlsx(
      { definition: definition(), rows },
      { sheetName: "Minhas Vendas" },
    );
    const workbook = await reload(buffer);
    expect(workbook.worksheets[0].name).toBe("Minhas Vendas");
  });

  it("título com caracteres inválidos do Excel vira nome de aba saneado", async () => {
    const def = definition({ name: "Vendas: 2026?" });
    const buffer = await exportReportToXlsx({ definition: def, rows });
    const workbook = await reload(buffer);
    expect(workbook.worksheets[0].name).toBe("Vendas 2026");
  });

  it("título só com caracteres inválidos cai no fallback 'Relatório'", async () => {
    const def = definition({ name: "???" });
    const buffer = await exportReportToXlsx({ definition: def, rows });
    const workbook = await reload(buffer);
    expect(workbook.worksheets[0].name).toBe("Relatório");
  });

  it("freezeHeader/autoFilter (default true) congelam a linha 1 e habilitam o filtro", async () => {
    const buffer = await exportReportToXlsx({ definition: definition(), rows });
    const sheet = (await reload(buffer)).worksheets[0];

    expect(sheet.views.some((v) => v.state === "frozen" && v.ySplit === 1)).toBe(true);
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("freezeHeader: false e autoFilter: false desligam ambos", async () => {
    const buffer = await exportReportToXlsx(
      { definition: definition(), rows },
      { freezeHeader: false, autoFilter: false },
    );
    const sheet = (await reload(buffer)).worksheets[0];

    // Sem nenhuma view custom, o exceljs relê `views` como `null` (não `[]`) — daí o `?? []`.
    expect((sheet.views ?? []).some((v) => v.state === "frozen")).toBe(false);
    expect(sheet.autoFilter).toBeFalsy();
  });

  it("boolean vira texto pt-BR (Sim/Não) em vez de booleano do Excel", async () => {
    type Item = { nome: string; ativo: boolean };
    const def: ReportDefinition<Item> = {
      slug: "itens",
      name: "Itens",
      columns: [
        { key: "nome", header: "Nome" },
        { key: "ativo", header: "Ativo" },
      ],
    };
    const buffer = await exportReportToXlsx({
      definition: def,
      rows: [
        { nome: "A", ativo: true },
        { nome: "B", ativo: false },
      ],
    });
    const sheet = (await reload(buffer)).worksheets[0];

    expect(sheet.getRow(2).getCell(2).value).toBe("Sim");
    expect(sheet.getRow(3).getCell(2).value).toBe("Não");
  });
});
