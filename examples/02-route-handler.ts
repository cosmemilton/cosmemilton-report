// Exemplo 02 — route handler GET do Next.js (App Router): o caminho recomendado para exportar
// relatórios (ver README, "Server ou client?"). Sem limite de payload de server action, com
// streaming, e mantém `@react-pdf/renderer`/`exceljs` fora do bundle do cliente.
//
// No seu projeto, este arquivo vira `app/api/relatorios/vendas/route.ts`.
import type { ReportOutputFormat } from "cosmemilton-report";
import { renderReportResponse } from "cosmemilton-report/next";
import { relatorioVendas, type Venda } from "./01-minimo.js";

// `?format=` vem direto da querystring — nunca confie nela sem validar contra uma lista fechada.
const FORMATOS_SUPORTADOS = ["pdf", "csv", "xlsx"] as const;

function parseFormat(value: string | null): ReportOutputFormat {
  return (FORMATOS_SUPORTADOS as readonly string[]).includes(value ?? "")
    ? (value as ReportOutputFormat)
    : "pdf";
}

/** Simula a busca de dados do app — no projeto real isto viria do banco (Prisma, etc.). */
async function buscarVendas(): Promise<Venda[]> {
  return [
    { data: "2026-08-01", cliente: "Ana Souza", total: 1234.5 },
    { data: "2026-08-02", cliente: "Bruno Lima", total: 850 },
    { data: "2026-08-03", cliente: "Carla Dias", total: 2310.9 },
  ];
}

export async function GET(req: Request): Promise<Response> {
  const format = parseFormat(new URL(req.url).searchParams.get("format"));

  return renderReportResponse({
    definition: relatorioVendas,
    rows: await buscarVendas(),
    format,
    fileName: "relatorio-vendas",
    globalConfig: { companyName: "Minha Empresa" },
  });
}
