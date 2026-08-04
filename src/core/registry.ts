// Registry declarativo de relatórios: coleção de ReportDefinition indexada por slug.
import type { ReportDefinition, SerializableReportDefinition } from "./types.js";

export type ReportRegistry = {
  list(): ReportDefinition<unknown>[];
  get<T = unknown>(slug: string): ReportDefinition<T> | undefined;
  has(slug: string): boolean;
  slugs(): string[];
};

/** Cria um registry a partir das definições de código. Lança em slug duplicado. */
export function createReportRegistry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  definitions: ReportDefinition<any>[],
): ReportRegistry {
  const bySlug = new Map<string, ReportDefinition<unknown>>();

  for (const definition of definitions) {
    if (bySlug.has(definition.slug)) {
      throw new Error(
        `Relatório duplicado: já existe um relatório registrado com o slug "${definition.slug}".`,
      );
    }
    bySlug.set(definition.slug, definition);
  }

  return {
    list: () => Array.from(bySlug.values()),
    get: <T = unknown>(slug: string) => bySlug.get(slug) as ReportDefinition<T> | undefined,
    has: (slug: string) => bySlug.has(slug),
    slugs: () => Array.from(bySlug.keys()),
  };
}

/**
 * Combina definições de código com definições salvas (criadas no designer): o CÓDIGO VENCE —
 * uma definição salva cujo slug já existe no código é descartada. Retorna código + salvas
 * restantes (uma `SerializableReportDefinition` é uma `ReportDefinition` válida — sem funções).
 */
export function mergeReportDefinitions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: ReportDefinition<any>[],
  stored: SerializableReportDefinition[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ReportDefinition<any>[] {
  const codeSlugs = new Set(code.map((definition) => definition.slug));
  const remainingStored = stored.filter((definition) => !codeSlugs.has(definition.slug));

  // Toda SerializableReportDefinition é estruturalmente uma ReportDefinition válida
  // (funções são todas opcionais) — hidratar é só passar adiante.
  return [...code, ...remainingStored];
}
