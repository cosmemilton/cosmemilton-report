"use client";

// useReportExport — hook de exportação com dois modos:
// - "endpoint": delega a geração ao servidor (`fetch(endpoint) → blob → download`), ideal para
//   pdf/xlsx (mantém os peers pesados fora do bundle client).
// - client-side (sem `endpoint`): gera o arquivo no próprio navegador a partir de `definition` —
//   csv/tsv/json direto do core (zero-dep); pdf/xlsx via `import()` dinâmico dos entries
//   correspondentes, para não puxar @react-pdf/renderer/exceljs para quem não usa esses formatos.
import { useCallback, useEffect, useRef, useState } from "react";
import { exportReportToCsv, exportReportToJson, exportReportToTsv } from "../core/export.js";
import type {
  ReportDefinition,
  ReportGlobalConfig,
  ReportOutputFormat,
  ReportRenderInput,
  ReportView,
} from "../core/types.js";
import { downloadBlob, downloadReportFile } from "./download.js";

export type UseReportExportOptions<T> = {
  /** Necessária no modo client-side (sem `endpoint`). */
  definition?: ReportDefinition<T>;
  globalConfig?: Partial<ReportGlobalConfig>;
  view?: ReportView | null;
  /** Presente = modo endpoint (route handler): `fetch(endpoint + "?format=..." + params)`. */
  endpoint?: string;
  /** Nome de arquivo default quando não é possível extraí-lo do `Content-Disposition` (modo
   *  endpoint) ou como base do nome no modo client-side. */
  fileName?: string;
};

export type UseReportExportReturn<T> = {
  exportReport: (options: {
    format: ReportOutputFormat;
    rows?: T[];
    params?: Record<string, string>;
  }) => Promise<void>;
  /** Copia as `rows` para a área de transferência em TSV (sem BOM). */
  copyToClipboard: (rows: T[]) => Promise<void>;
  isExporting: boolean;
  lastError: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `aaaa-mm-dd` a partir dos componentes LOCAIS de `date` — mesma convenção usada em
 *  `next/report-response.ts` (evita o dia mudar por causa do fuso horário). */
function toIsoDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function defaultFileName(slug: string): string {
  return `${slug}-${toIsoDateString(new Date())}`;
}

/** Monta a URL do modo endpoint: `format` sempre primeiro, seguido dos demais `params`. Respeita
 *  uma query string já existente em `endpoint` (raro, mas possível). */
function buildEndpointUrl(
  endpoint: string,
  format: ReportOutputFormat,
  params?: Record<string, string>,
): string {
  const search = new URLSearchParams({ format, ...params });
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}${search.toString()}`;
}

/** Extrai o nome de arquivo de um header `Content-Disposition`: prefere `filename*=UTF-8''...`
 *  (decodificado — nome real, com acentos), com fallback para `filename="..."` (ASCII). */
function extractFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // percent-encoding malformado — cai para o fallback ASCII abaixo.
    }
  }

  const asciiMatch = /filename="([^"]*)"/i.exec(contentDisposition);
  if (asciiMatch) {
    return asciiMatch[1];
  }

  return null;
}

/**
 * Hook de exportação de relatórios no cliente. Em modo endpoint (`options.endpoint` definido),
 * delega a geração a um route handler e baixa o resultado; sem `endpoint`, gera o arquivo no
 * próprio navegador a partir de `options.definition`. Também expõe `copyToClipboard` (TSV) e o
 * estado de progresso (`isExporting`/`lastError`).
 */
export function useReportExport<T>(options: UseReportExportOptions<T>): UseReportExportReturn<T> {
  const { definition, globalConfig, view, endpoint, fileName } = options;
  const [isExporting, setIsExporting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const exportViaEndpoint = useCallback(
    async (format: ReportOutputFormat, params?: Record<string, string>) => {
      const url = buildEndpointUrl(endpoint as string, format, params);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Falha ao exportar relatório: o servidor respondeu com status ${res.status}.`,
        );
      }
      const blob = await res.blob();
      const resolvedFileName =
        extractFileName(res.headers.get("Content-Disposition")) ?? fileName ?? "relatorio";
      downloadBlob(blob, resolvedFileName);
    },
    [endpoint, fileName],
  );

  const exportViaClientSide = useCallback(
    async (format: ReportOutputFormat, rows: T[]) => {
      const def = definition as ReportDefinition<T>;
      const input: ReportRenderInput<T> = { definition: def, rows, globalConfig, view };
      const resolvedFileName = fileName ?? defaultFileName(def.slug);

      switch (format) {
        case "csv": {
          downloadReportFile(exportReportToCsv(input), resolvedFileName, format);
          return;
        }
        case "tsv": {
          downloadReportFile(exportReportToTsv(input), resolvedFileName, format);
          return;
        }
        case "json": {
          downloadReportFile(exportReportToJson(input), resolvedFileName, format);
          return;
        }
        case "pdf": {
          const { renderReportToBuffer } = await import("../pdf.js");
          downloadReportFile(await renderReportToBuffer(input), resolvedFileName, format);
          return;
        }
        case "xlsx": {
          const { exportReportToXlsx } = await import("../xlsx.js");
          downloadReportFile(await exportReportToXlsx(input), resolvedFileName, format);
          return;
        }
        default: {
          const exhaustiveCheck: never = format;
          throw new Error(`Formato de relatório não suportado: "${String(exhaustiveCheck)}".`);
        }
      }
    },
    [definition, fileName, globalConfig, view],
  );

  const exportReport = useCallback(
    async (exportOptions: {
      format: ReportOutputFormat;
      rows?: T[];
      params?: Record<string, string>;
    }) => {
      const { format, rows, params } = exportOptions;

      if (!endpoint && !definition) {
        const message =
          "useReportExport: informe `definition` (modo client-side) ou `endpoint` (modo servidor) para exportar.";
        if (mountedRef.current) setLastError(message);
        throw new Error(message);
      }

      if (mountedRef.current) {
        setIsExporting(true);
        setLastError(null);
      }

      try {
        if (endpoint) {
          await exportViaEndpoint(format, params);
        } else {
          await exportViaClientSide(format, rows ?? []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao exportar relatório.";
        if (mountedRef.current) setLastError(message);
      } finally {
        if (mountedRef.current) setIsExporting(false);
      }
    },
    [definition, endpoint, exportViaClientSide, exportViaEndpoint],
  );

  const copyToClipboard = useCallback(
    async (rows: T[]) => {
      if (!definition) {
        const message =
          "useReportExport: informe `definition` para copiar o relatório para a área de transferência.";
        if (mountedRef.current) setLastError(message);
        throw new Error(message);
      }

      if (mountedRef.current) {
        setIsExporting(true);
        setLastError(null);
      }

      try {
        const tsv = exportReportToTsv({ definition, rows, globalConfig, view });
        await navigator.clipboard.writeText(tsv);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Falha ao copiar o relatório para a área de transferência.";
        if (mountedRef.current) setLastError(message);
      } finally {
        if (mountedRef.current) setIsExporting(false);
      }
    },
    [definition, globalConfig, view],
  );

  return { exportReport, copyToClipboard, isExporting, lastError };
}
