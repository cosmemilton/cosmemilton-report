// Auto-provisionamento de views "system": garante que todo relatório do registry tenha ao
// menos a view padrão do sistema no storage, sem nunca sobrescrever o que já existe.
import type { ReportRegistry } from "../registry.js";
import type { ReportDefinition, ReportView } from "../types.js";
import type { ReportStorageAdapter } from "./adapter.js";

/**
 * Cria a view "system" de uma definição: id `system:${slug}`, somente leitura (`isSystem`),
 * sem overrides de coluna/cabeçalho/estilo (reflete a definição de código como está).
 * `isDefault` nasce `true` aqui — quem decide se ela deve mesmo entrar como default do slug é
 * `ensureReportViews`, que ajusta a flag conforme o storage já tiver ou não uma view default.
 */
export function createSystemView(definition: ReportDefinition<unknown>): ReportView {
  return {
    id: `system:${definition.slug}`,
    slug: definition.slug,
    name: "Padrão do sistema",
    isSystem: true,
    isDefault: true,
  };
}

/**
 * Provisionamento idempotente (padrão `ensureReportLayouts` do pronto-erp-core): para cada slug
 * do `registry` sem view "system" no `adapter`, cria uma via `createSystemView`. Nunca
 * sobrescreve views existentes. Se o slug já tiver alguma view default (de usuário ou de uma
 * execução anterior), a view system criada nasce com `isDefault: false` para não roubar o
 * default de ninguém. Retorna os ids das views criadas e das que já existiam.
 */
export async function ensureReportViews(options: {
  registry: ReportRegistry;
  adapter: ReportStorageAdapter;
}): Promise<{ created: string[]; existing: string[] }> {
  const { registry, adapter } = options;
  const created: string[] = [];
  const existing: string[] = [];

  for (const definition of registry.list()) {
    const systemId = `system:${definition.slug}`;
    const currentSystemView = await adapter.getView(systemId);

    if (currentSystemView) {
      existing.push(systemId);
      continue;
    }

    const slugViews = await adapter.listViews(definition.slug);
    const hasDefault = slugViews.some((view) => view.isDefault);

    const systemView = createSystemView(definition);
    await adapter.saveView(hasDefault ? { ...systemView, isDefault: false } : systemView);
    created.push(systemId);
  }

  return { created, existing };
}
