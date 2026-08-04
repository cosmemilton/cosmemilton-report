// Exemplo 06 — relatórios criados pelo usuário (designer) + o route handler genérico que serve
// tanto os relatórios de código quanto os salvos em runtime. No seu projeto isto vira DOIS
// arquivos (aqui juntos só para leitura mais fácil do exemplo):
//   - app/relatorios/designer/page.tsx  ("use client" — trecho 1)
//   - app/api/relatorios/[slug]/route.ts (server — trecho 2)
import type { ReactElement } from "react";
import {
  createMemoryReportAdapter,
  createReportRegistry,
  mergeReportDefinitions,
  type ReportDataSource,
  type ReportDefinition,
  type SerializableReportDefinition,
} from "cosmemilton-report";
import { renderReportResponse } from "cosmemilton-report/next";
import { CmReportDesigner } from "cosmemilton-report/client";
import { relatorioVendas, type Venda } from "./01-minimo.js";

// ---------------------------------------------------------------------------
// Trecho 1 — app/relatorios/designer/page.tsx ("use client")
// ---------------------------------------------------------------------------

// Em produção: `createLocalStorageReportAdapter()` no client, ou um adapter Prisma no server
// (ver README, "Persistência"). Aqui usamos o adapter de memória só para o exemplo compilar
// isoladamente, sem depender de `window`.
const adapter = createMemoryReportAdapter();

// Fontes de dados que o app oferece ao usuário no designer — cada uma vira uma opção de
// "fonte de dados" com os campos disponíveis para virar coluna.
const dataSources: ReportDataSource[] = [
  {
    id: "vendas",
    name: "Vendas",
    fields: [
      { key: "data", label: "Data", format: "date" },
      { key: "cliente", label: "Cliente" },
      { key: "total", label: "Total", format: "currency" },
    ],
  },
];

/** Amostra real para o preview do designer — no projeto real viria do banco. Serve também de
 *  fetcher no route handler abaixo (trecho 2). */
async function buscarAmostraVendas(): Promise<Venda[]> {
  return [
    { data: "2026-08-01", cliente: "Ana Souza", total: 1234.5 },
    { data: "2026-08-02", cliente: "Bruno Lima", total: 850 },
  ];
}

export function PaginaDesignerRelatorios(): ReactElement {
  function handleSaved(definition: SerializableReportDefinition): void {
    // No projeto real: router.push(`/relatorios/${definition.slug}`)
    console.log("Relatório salvo:", definition.slug);
  }

  return (
    <CmReportDesigner
      dataSources={dataSources}
      adapter={adapter}
      getPreviewRows={async () => buscarAmostraVendas()}
      onSaved={handleSaved}
    />
  );
}

// ---------------------------------------------------------------------------
// Trecho 2 — app/api/relatorios/[slug]/route.ts (server) — serve os dois mundos: relatórios
// registrados em código (`definicoesDeCodigo`) E os salvos pelo designer
// (`adapter.listDefinitions()`), com o código sempre vencendo em caso de slug repetido.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const definicoesDeCodigo: ReportDefinition<any>[] = [relatorioVendas];

// Mapa `dataSource` (ou `slug`, quando ausente) → função que busca as linhas. Relatórios criados
// no designer sempre declaram `dataSource` (o id de uma das `dataSources` acima).
const fetchers: Record<string, () => Promise<Record<string, unknown>[]>> = {
  vendas: buscarAmostraVendas,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  const defs = mergeReportDefinitions(definicoesDeCodigo, await adapter.listDefinitions());
  const registry = createReportRegistry(defs);
  const def = registry.get(slug);

  if (!def) {
    return new Response("Relatório não encontrado", { status: 404 });
  }

  const fetchRows = fetchers[def.dataSource ?? slug];
  if (!fetchRows) {
    return new Response("Fonte de dados não configurada para este relatório", { status: 500 });
  }

  return renderReportResponse({
    definition: def,
    rows: await fetchRows(),
    format: "pdf",
    fileName: slug,
  });
}
