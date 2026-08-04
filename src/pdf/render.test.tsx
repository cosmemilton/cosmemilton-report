// @vitest-environment node
// react-pdf usa seu próprio reconciler; testá-lo sob jsdom pode conflitar com ele (ver plano,
// seção "Riscos"). Por isso este arquivo roda no ambiente node do vitest.
import { Text } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type {
  ReportColumn,
  ReportDefinition,
  ReportPdfCellContext,
  ReportSection,
} from "../core/types.js";
import { renderReportToBuffer, renderReportToStream } from "./render.js";

type Venda = { vendedor: string; produto: string; quantidade: number; total: number };

function makeRows(count: number): Venda[] {
  return Array.from({ length: count }, (_, i) => ({
    vendedor: i % 2 === 0 ? "Ana" : "Bruno",
    produto: `Produto ${i}`,
    quantidade: i + 1,
    total: (i + 1) * 10,
  }));
}

/** Confere a assinatura `%PDF` nos primeiros bytes e um tamanho mínimo plausível para um PDF
 *  com conteúdo real (não só um documento vazio). */
function looksLikeValidPdf(bytes: Uint8Array): boolean {
  const signature = Buffer.from(bytes.slice(0, 4)).toString("ascii");
  return signature === "%PDF" && bytes.length > 1000;
}

const baseColumns: ReportColumn<Venda>[] = [
  { key: "vendedor", header: "Vendedor" },
  { key: "quantidade", header: "Qtd", format: "integer" },
  { key: "total", header: "Total", format: "currency" },
];

function definition(overrides?: Partial<ReportDefinition<Venda>>): ReportDefinition<Venda> {
  return {
    slug: "vendas",
    name: "Relatório de Vendas",
    columns: baseColumns,
    ...overrides,
  };
}

describe("renderReportToBuffer", () => {
  it("gera um PDF válido (assinatura %PDF, tamanho > 1000 bytes) para 3 colunas x 50 linhas", async () => {
    const buffer = await renderReportToBuffer({ definition: definition(), rows: makeRows(50) });
    expect(looksLikeValidPdf(buffer)).toBe(true);
  });

  it("não lança com group+showSubtotal, coluna com pdfRender custom, sections after-summary e summary", async () => {
    const columns: ReportColumn<Venda>[] = [
      ...baseColumns,
      {
        key: "destaque",
        header: "Destaque",
        exportValue: (row) => (row.total > 100 ? "Alto" : "Normal"),
        pdfRender: (ctx: ReportPdfCellContext<Venda>) => (
          <Text style={{ color: ctx.value === "Alto" ? "#b91c1c" : "#111827" }}>
            {ctx.formatted}
          </Text>
        ),
      },
    ];

    const sections: ReportSection<Venda>[] = [
      {
        id: "assinatura",
        position: "after-summary",
        pdfRender: () => <Text>Assinatura: ____________________</Text>,
      },
    ];

    const def = definition({
      columns,
      group: { by: "vendedor", showSubtotal: true },
      summary: [
        { label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" },
      ],
      sections,
    });

    const buffer = await renderReportToBuffer({ definition: def, rows: makeRows(20) });
    expect(looksLikeValidPdf(buffer)).toBe(true);
  });

  it("aceita paperSize Letter, orientation landscape e margens custom sem lançar", async () => {
    const buffer = await renderReportToBuffer({
      definition: definition(),
      rows: makeRows(5),
      globalConfig: {
        paperSize: "Letter",
        orientation: "landscape",
        marginTopMm: 20,
        marginBottomMm: 20,
        marginLeftMm: 25,
        marginRightMm: 25,
      },
    });
    expect(looksLikeValidPdf(buffer)).toBe(true);
  });

  it("showGeneratedAt: false e showPageNumbers: false não lançam", async () => {
    const buffer = await renderReportToBuffer({
      definition: definition({ header: { showGeneratedAt: false, showPageNumbers: false } }),
      rows: makeRows(5),
    });
    expect(looksLikeValidPdf(buffer)).toBe(true);
  });
});

describe("renderReportToStream", () => {
  it("retorna um stream Node cujo conteúdo também é um PDF válido", async () => {
    const stream = await renderReportToStream({ definition: definition(), rows: makeRows(5) });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(chunk as Buffer));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    expect(looksLikeValidPdf(new Uint8Array(Buffer.concat(chunks)))).toBe(true);
  });
});
