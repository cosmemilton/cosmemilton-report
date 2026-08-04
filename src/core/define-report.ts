// defineReport — helper de autoria de definições de relatório (código, no registry do app).
import type { ReportDefinition } from "./types.js";

/**
 * Normaliza uma `ReportDefinition`: valida que não há keys de coluna duplicadas e preenche
 * `sortOrder` default pelo índice da coluna quando ausente. Retorna a definição tipada.
 */
export function defineReport<T>(definition: ReportDefinition<T>): ReportDefinition<T> {
  const seen = new Set<string>();
  for (const column of definition.columns) {
    if (seen.has(column.key)) {
      throw new Error(
        `Relatório "${definition.slug}": a coluna com key "${column.key}" está duplicada.`,
      );
    }
    seen.add(column.key);
  }

  const columns = definition.columns.map((column, index) => ({
    ...column,
    sortOrder: column.sortOrder ?? index,
  }));

  return { ...definition, columns };
}
