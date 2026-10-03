// @vitest-environment node
import { Link, Text, renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";
import type { ReportRenderInput } from "../core/types.js";
import { readPdf } from "../../tests/pdf.js";
import {
  createCompositeReportDocument,
  renderCompositeReportToBuffer,
  renderCompositeReportToStream,
} from "../pdf.js";

type Movement = { code: number; description: string; total: string };
type Bank = { name: string; balance: string };
function inputs(): [ReportRenderInput<Movement>, ReportRenderInput<Bank>] {
  return [
    {
      definition: {
        slug: "movements",
        name: "Resumo Financeiro",
        header: { showGeneratedAt: false },
        columns: [
          { key: "code", header: "Código", width: "15%" },
          { key: "description", header: "Movimento", width: "65%" },
          { key: "total", header: "Total", width: "20%" },
        ],
      },
      rows: Array.from({ length: 5 }, (_, i) => ({
        code: i + 1,
        description: "CRÉDITO-" + (i + 1),
        total: "100,00",
      })),
      globalConfig: { footerText: "Rodapé movimentos", paperSize: "A4" },
    },
    {
      definition: {
        slug: "banks",
        name: "Bancos",
        header: { showGeneratedAt: false },
        columns: [
          { key: "name", header: "Banco", width: "60%" },
          { key: "balance", header: "Saldo", width: "40%" },
        ],
        sections: [
          {
            id: "total",
            position: "after-table",
            pdfRender: () => <Text>TOTAL GLOBAL 500,00</Text>,
          },
        ],
      },
      rows: Array.from({ length: 5 }, (_, i) => ({ name: "BANCO-" + (i + 1), balance: "100,00" })),
      globalConfig: { footerText: "Rodapé bancos", paperSize: "Letter", orientation: "landscape" },
    },
  ];
}
describe("Composição pública de relatórios", { timeout: 40_000 }, () => {
  for (const engine of ["auto", "react-pdf"] as const) {
    it(`duas tabelas distintas, cabeçalhos, ordem, totais e contador global (${engine})`, async () => {
      const d = inputs(),
        callback = vi.fn(d[1].definition.sections![0].pdfRender);
      d[1].definition.sections![0].pdfRender = callback;
      const pages = await readPdf(
        await renderCompositeReportToBuffer(d, { maxRowsPerBlock: 2, engine }),
      );
      expect(pages).toHaveLength(6);
      expect(callback).toHaveBeenCalledTimes(1);
      pages.forEach((p, index) => {
        const texts = p.items.map((x) => x.text);
        expect(texts.filter((s) => s.startsWith("Página "))).toEqual([`Página ${index + 1} de 6`]);
        expect(
          texts.filter((s) => s === (index < 3 ? "Rodapé movimentos" : "Rodapé bancos")),
        ).toHaveLength(1);
        expect(texts).toContain(index < 3 ? "Movimento" : "Banco");
        expect(texts).not.toContain(index < 3 ? "Banco" : "Movimento");
        expect(p.width > p.height).toBe(index >= 3);
      });
      expect(
        pages.flatMap((p) =>
          p.items.filter((x) => x.text.startsWith("CRÉDITO-")).map((x) => x.text),
        ),
      ).toEqual(d[0].rows.map((r) => r.description));
      expect(
        pages.flatMap((p) => p.items.filter((x) => x.text.startsWith("BANCO-")).map((x) => x.text)),
      ).toEqual(d[1].rows.map((r) => r.name));
      expect(
        pages.flatMap((p) => p.items.filter((x) => x.text === "TOTAL GLOBAL 500,00")),
      ).toHaveLength(1);
    });
  }
  it("continuação física repete cabeçalho próprio, sem truncar tabela nem total", async () => {
    const d = inputs();
    d[0].rows = Array.from({ length: 130 }, (_, i) => ({
      code: i + 1,
      description: "MOV-VOLUME-" + i,
      total: "0,01",
    }));
    d[1].rows = Array.from({ length: 130 }, (_, i) => ({
      name: "BANCO-VOLUME-" + i,
      balance: "0,01",
    }));
    const pages = await readPdf(await renderCompositeReportToBuffer(d, { maxRowsPerBlock: false }));
    expect(pages.length).toBeGreaterThan(4);
    const actualMov = pages.flatMap((p) =>
      p.items.filter((x) => x.text.startsWith("MOV-VOLUME-")).map((x) => x.text),
    );
    const actualBanks = pages.flatMap((p) =>
      p.items.filter((x) => x.text.startsWith("BANCO-VOLUME-")).map((x) => x.text),
    );
    expect(actualMov).toEqual(d[0].rows.map((r) => r.description));
    expect(actualBanks).toEqual(d[1].rows.map((r) => r.name));
    pages.forEach((p, i) => {
      const texts = p.items.map((x) => x.text);
      expect(texts).toContain(`Página ${i + 1} de ${pages.length}`);
      if (texts.some((s) => s.startsWith("MOV-VOLUME-"))) expect(texts).toContain("Movimento");
      if (texts.some((s) => s.startsWith("BANCO-VOLUME-"))) expect(texts).toContain("Banco");
    });
  });
  it("uma árvore contínua conserva links entre partes e render dinâmico global", async () => {
    const d = inputs();
    d[0].rows = d[0].rows.slice(0, 1);
    d[1].rows = d[1].rows.slice(0, 1);
    d[0].definition.sections = [
      {
        id: "link",
        position: "after-table",
        pdfRender: () => <Link src="#bank-target">Ir ao banco</Link>,
      },
    ];
    d[1].definition.sections = [
      {
        id: "destino",
        position: "after-table",
        pdfRender: () => (
          <Text
            id="bank-target"
            render={({ pageNumber, totalPages }) => `CONTEXTO ${pageNumber}/${totalPages}`}
          />
        ),
      },
    ];
    const pages = await readPdf(await renderCompositeReportToBuffer(d, { maxRowsPerBlock: 1 }));
    expect(pages).toHaveLength(2);
    expect(pages[1].items.map((x) => x.text)).toContain("CONTEXTO 2/2");
    expect(pages[0].items.map((x) => x.text)).toContain("Página 1 de 2");
    expect(pages[1].items.map((x) => x.text)).toContain("Página 2 de 2");
  });
  it("árvore pública e stream mantêm as duas partes; vazio/bobina/opções inválidas diagnosticados", async () => {
    const d = inputs();
    d[0].rows = [];
    d[1].rows = [];
    const tree = createCompositeReportDocument(d, { maxRowsPerBlock: false });
    const rendered = await renderToBuffer(tree as Parameters<typeof renderToBuffer>[0]);
    expect(await readPdf(rendered)).toHaveLength(2);
    const stream = await renderCompositeReportToStream(d);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) chunks.push(chunk as Uint8Array);
    expect(await readPdf(Buffer.concat(chunks))).toHaveLength(2);
    await expect(renderCompositeReportToBuffer([])).rejects.toThrow("pelo menos um relatório");
    d[1].globalConfig = { paperSize: "80mm" };
    await expect(renderCompositeReportToBuffer(d)).rejects.toThrow("A4 ou Letter");
    await expect(renderCompositeReportToBuffer(inputs(), { maxRowsPerBlock: 0 })).rejects.toThrow(
      "inteiro positivo",
    );
  });
});
