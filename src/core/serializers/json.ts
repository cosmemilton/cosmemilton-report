// datasetToJson — serializa um ReportDataset em JSON, em dois formatos ("shapes"):
// "rows" (default) é um array simples de objetos { [column.key]: raw }, prático para consumo
// por outras ferramentas; "full" é o próprio dataset (meta/columns/rows/groups/total/summary,
// cada célula com raw+formatted), útil para reconstruir a tabela completa no cliente.
import type { ReportDataset } from "../types.js";

/**
 * Serializa `dataset` em JSON. `shape: "rows"` (default) gera um array de objetos com o valor
 * bruto (`raw`) de cada coluna, indexado por `column.key` — `Date` é serializada como string
 * ISO pelo próprio `JSON.stringify`. `shape: "full"` serializa o dataset inteiro (meta,
 * columns, rows com raw+formatted, groups/total quando presentes, summary).
 */
export function datasetToJson(
  dataset: ReportDataset,
  options?: { shape?: "rows" | "full" },
): string {
  const shape = options?.shape ?? "rows";

  if (shape === "full") {
    return JSON.stringify(dataset);
  }

  const rows = dataset.rows.map((row) => {
    const record: Record<string, unknown> = {};
    dataset.columns.forEach((column, index) => {
      record[column.key] = row.cells[index]?.raw ?? null;
    });
    return record;
  });

  return JSON.stringify(rows);
}
