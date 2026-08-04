// export.ts — atalhos que levam direto de um ReportRenderInput até a string serializada,
// percorrendo a pipeline única do core: resolveReport → buildReportDataset → serializer.
import { buildReportDataset } from "./dataset.js";
import { resolveReport } from "./resolve.js";
import type { CsvOptions } from "./serializers/csv.js";
import { datasetToCsv } from "./serializers/csv.js";
import { datasetToJson } from "./serializers/json.js";
import { datasetToTsv } from "./serializers/tsv.js";
import type { ReportDataset, ReportRenderInput } from "./types.js";

/** Resolve `input` (definição + camadas de config) e monta o dataset — passo comum a todos
 *  os atalhos `exportReportTo*`. */
function buildDatasetFromInput<T>(input: ReportRenderInput<T>): ReportDataset {
  const resolved = resolveReport({
    definition: input.definition,
    globalConfig: input.globalConfig,
    view: input.view,
    overrides: input.overrides,
  });

  return buildReportDataset(resolved, input.rows, {
    userName: input.userName,
    generatedAt: input.generatedAt,
  });
}

/** Atalho: `input` → CSV pt-BR (";" + BOM por default; ver `CsvOptions`). */
export function exportReportToCsv<T>(input: ReportRenderInput<T>, options?: CsvOptions): string {
  return datasetToCsv(buildDatasetFromInput(input), options);
}

/** Atalho: `input` → TSV (tab, sem BOM). */
export function exportReportToTsv<T>(input: ReportRenderInput<T>): string {
  return datasetToTsv(buildDatasetFromInput(input));
}

/** Atalho: `input` → JSON (`shape: "rows"` por default; ver `datasetToJson`). */
export function exportReportToJson<T>(
  input: ReportRenderInput<T>,
  options?: { shape?: "rows" | "full" },
): string {
  return datasetToJson(buildDatasetFromInput(input), options);
}
