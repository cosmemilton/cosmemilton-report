"use client";

// Exemplo 03 — botão de exportação client-side: `useReportExport` em modo endpoint delega a
// geração ao route handler do exemplo 02 (`fetch` → blob → download), mantendo o bundle do
// cliente livre de `@react-pdf/renderer`/`exceljs`.
import type { ReactElement } from "react";
import { useReportExport } from "cosmemilton-report/client";
import { CmButton } from "cosmemilton-ui/client";

export function BotaoExportarVendas(): ReactElement {
  const { exportReport, isExporting } = useReportExport({
    endpoint: "/api/relatorios/vendas",
  });

  return (
    <CmButton
      loading={isExporting}
      onClick={() => exportReport({ format: "pdf", params: { mes: "2026-08" } })}
    >
      Exportar PDF
    </CmButton>
  );
}
