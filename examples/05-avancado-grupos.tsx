// Exemplo 05 — recursos avançados: agrupamento com subtotal, coluna com renderização PDF
// condicional (cor conforme o valor da célula) e uma seção customizada após o sumário.
import { defineReport } from "cosmemilton-report";
import type { ReportPdfCellContext } from "cosmemilton-report";
import { Text } from "cosmemilton-report/pdf";

export type VendaDetalhada = {
  vendedor: string;
  produto: string;
  quantidade: number;
  total: number;
};

export const relatorioVendasPorVendedor = defineReport<VendaDetalhada>({
  slug: "vendas-por-vendedor",
  name: "Vendas por Vendedor",
  columns: [
    { key: "vendedor", header: "Vendedor", width: "25%" },
    { key: "produto", header: "Produto", width: "35%" },
    { key: "quantidade", header: "Qtd", format: "integer", width: "10%" },
    { key: "total", header: "Total", format: "currency", width: "15%" },
    {
      key: "destaque",
      header: "Destaque",
      width: "15%",
      // Usado por TODOS os formatos (CSV/XLSX/JSON/PDF sem `pdfRender` custom).
      exportValue: (row) => (row.total > 500 ? "Alto" : "Normal"),
      // Só o PDF: cor condicional via `Text` reexportado de `cosmemilton-report/pdf` — assim o
      // código do app não precisa depender diretamente de `@react-pdf/renderer`.
      pdfRender: (ctx: ReportPdfCellContext<VendaDetalhada>) => (
        <Text style={{ color: ctx.value === "Alto" ? "#b91c1c" : "#111827" }}>{ctx.formatted}</Text>
      ),
    },
  ],
  group: { by: "vendedor", showSubtotal: true },
  summary: [
    { label: "Qtde. de vendas", sourceColumn: "*", operation: "count" },
    { label: "Ticket médio", sourceColumn: "total", operation: "avg", format: "currency" },
    { label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" },
  ],
  sections: [
    {
      id: "assinatura",
      position: "after-summary",
      pdfRender: () => <Text>Assinatura: ____________________</Text>,
    },
  ],
});
