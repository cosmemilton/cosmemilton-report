// groupRows — agrupa linhas conforme ReportGroupConfig, preservando a ordem de primeira
// aparição de cada chave de grupo (não ordena alfabeticamente nem por qualquer outro critério).
import type { ReportGroupConfig } from "./types.js";

/** Resolve `group.by` (key de coluna ou função) numa função `(row) => string` uniforme. */
function keyFnOf<T>(by: ReportGroupConfig<T>["by"]): (row: T) => string {
  if (typeof by === "function") {
    return by;
  }
  return (row: T) => {
    const raw = (row as Record<string, unknown>)[by];
    return raw === null || raw === undefined ? "" : String(raw);
  };
}

/**
 * Agrupa `rows` de acordo com `group.by`. A ordem dos grupos retornados é a ordem de primeira
 * aparição de cada chave nas linhas originais. `label` usa `group.label(key, rows)` quando
 * fornecido; por default é a própria `key` do grupo.
 */
export function groupRows<T>(
  rows: T[],
  group: ReportGroupConfig<T>,
): { key: string; label: string; rows: T[] }[] {
  const keyOf = keyFnOf(group.by);

  const order: string[] = [];
  const rowsByKey = new Map<string, T[]>();

  for (const row of rows) {
    const key = keyOf(row);
    let bucket = rowsByKey.get(key);
    if (!bucket) {
      bucket = [];
      rowsByKey.set(key, bucket);
      order.push(key);
    }
    bucket.push(row);
  }

  return order.map((key) => {
    const groupedRows = rowsByKey.get(key) as T[];
    return {
      key,
      label: group.label ? group.label(key, groupedRows) : key,
      rows: groupedRows,
    };
  });
}
