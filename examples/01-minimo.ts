// Exemplo 01 — o mínimo para ter um relatório: uma definição com 3 colunas e um total no rodapé.
// `relatorioVendas`/`Venda` são importados pelos demais exemplos (`./01-minimo.js`).
import { defineReport } from "cosmemilton-report";

export type Venda = { data: string; cliente: string; total: number };

export const relatorioVendas = defineReport<Venda>({
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date", width: "15%" },
    { key: "cliente", header: "Cliente", width: "55%" },
    { key: "total", header: "Total", format: "currency", width: "30%" },
  ],
  summary: [{ label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" }],
});
