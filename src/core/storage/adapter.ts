// Contrato de persistência do report builder. A lib não conhece banco de dados — quem integra
// implementa este adapter (localStorage e memória vêm prontos; Prisma/API ficam por conta do
// app). Todos os métodos são assíncronos para caber tanto storage síncrono (localStorage,
// memória) quanto remoto (Prisma, fetch).
import type { ReportGlobalConfig, ReportView, SerializableReportDefinition } from "../types.js";

export type ReportStorageAdapter = {
  /** Config global salva, ou `null` quando nada foi salvo ainda (chamador aplica seu próprio
   *  default nesse caso). */
  loadGlobalConfig(): Promise<ReportGlobalConfig | null>;
  saveGlobalConfig(config: ReportGlobalConfig): Promise<void>;

  /** Lista as views; `slug` filtra por relatório, omitido retorna todas. */
  listViews(slug?: string): Promise<ReportView[]>;
  getView(id: string): Promise<ReportView | null>;
  /** Upsert por `id`. */
  saveView(view: ReportView): Promise<void>;
  /** Lança se a view for `isSystem` (view do sistema é somente leitura). */
  deleteView(id: string): Promise<void>;
  /** Marca `viewId` como default do `slug` e zera `isDefault` das demais views do mesmo slug. */
  setDefaultView(slug: string, viewId: string): Promise<void>;

  // Definições criadas em runtime pelo designer (JSON puro, sem funções):
  listDefinitions(): Promise<SerializableReportDefinition[]>;
  getDefinition(slug: string): Promise<SerializableReportDefinition | null>;
  /** Upsert por `slug`. */
  saveDefinition(definition: SerializableReportDefinition): Promise<void>;
  /** Remove a definição E todas as views associadas ao seu `slug`. */
  deleteDefinition(slug: string): Promise<void>;
};
