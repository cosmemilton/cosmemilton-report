"use client";

// CmReportDesigner — cria/edita `SerializableReportDefinition`s em runtime (estilo
// FastReport/FortesReport tabular), a partir das fontes de dados que o app registra
// (`ReportDataSource`). Ao contrário do `CmReportLayoutEditor` (que só grava overrides
// serializáveis por cima de uma `ReportDefinition` de código), o designer edita a DEFINIÇÃO
// inteira — colunas completas (`SerializableReportColumn[]`), não overrides — porque não existe
// nenhum código por trás: o relatório nasce aqui.
//
// Reuso das abas do editor (decisão de arquitetura, ver plano — "Designer", e o comentário em
// `designer/labels.ts`): `HeaderTab`/`StyleTab`/`SummaryTab` já são controlados via `view` +
// `onViewChange` com patches rasos — os wrappers `DesignerHeaderTab`/`DesignerStyleTab`/
// `DesignerSummaryTab` abaixo só empacotam `draft.header`/`draft.style`/`draft.summary` numa
// `ReportView` sintética (só os campos que cada aba lê) e desempacotam o patch de volta pro
// `draft` — nenhum dos dois componentes precisa saber que o outro existe. Isso só funciona sem
// atrito porque `CmReportDesignerLabels` ESTENDE `CmReportLayoutEditorLabels` (ver labels.ts):
// os três componentes tipam `labels` como o tipo completo do editor, e um `Pick<...>` não bastaria.
// A aba "Colunas", por outro lado, PRECISA ser própria do designer (`DesignerColumnsTab`, definida
// neste arquivo): a `ColumnsTab` do editor é inteiramente sobre o merge definição+view (dois
// níveis, `resolveColumns` + overrides por `key`); o designer só tem UM nível — as colunas
// completas do rascunho — então reaproveita apenas os campos de `column-fields.tsx` (mesmo
// header/width/align/format usados lá) e monta sua própria lista, com um botão "Remover coluna"
// que a aba do editor não tem (lá colunas somem/aparecem por `visible`, nunca são removidas da
// definição).
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  CmAlert,
  CmButton,
  CmEmpty,
  CmInput,
  CmSelect,
  CmSwitch,
  CmTabs,
  CmTabsContent,
  CmTabsList,
  CmTabsTrigger,
} from "cosmemilton-ui/client";
import { CmIcon } from "cosmemilton-ui/server";
import { generatePlaceholderRows } from "../../core/placeholder.js";
import { parseReportDefinition } from "../../core/parse.js";
import type { ReportStorageAdapter } from "../../core/storage/adapter.js";
import type {
  ReportColumnAlign,
  ReportDataSource,
  ReportDataSourceField,
  ReportDefinition,
  ReportFormat,
  ReportGlobalConfig,
  ReportView,
  SerializableReportColumn,
  SerializableReportDefinition,
} from "../../core/types.js";
import {
  ColumnAlignField,
  ColumnFormatField,
  ColumnHeaderField,
  ColumnWidthField,
} from "../editor/column-fields.js";
import { HeaderTab } from "../editor/header-tab.js";
import { StyleTab } from "../editor/style-tab.js";
import { SummaryTab } from "../editor/summary-tab.js";
import { CmReportPdfPreview } from "../preview/cm-report-pdf-preview.js";
import { DataSourceStep } from "./data-source-step.js";
import { GroupSection } from "./group-section.js";
import { defaultReportDesignerLabels, type CmReportDesignerLabels } from "./labels.js";

export type CmReportDesignerProps = {
  /** Fontes de dados que o app oferece ao usuário (campos disponíveis). */
  dataSources: ReportDataSource[];
  adapter: ReportStorageAdapter;
  /** Presente = editar definição salva (slug travado); ausente = criar uma nova. */
  definition?: SerializableReportDefinition;
  onSaved?: (definition: SerializableReportDefinition) => void;
  onCancel?: () => void;
  /** Linhas reais de amostra por fonte; sem isso (ou se a promessa rejeitar) o preview usa
   *  `generatePlaceholderRows`. */
  getPreviewRows?: (dataSource: ReportDataSource) => Promise<Record<string, unknown>[]>;
  globalConfig?: Partial<ReportGlobalConfig>;
  className?: string;
  labels?: Partial<CmReportDesignerLabels>;
};

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** minúsculas, sem acento (NFD + remove marcas diacríticas via `\p{Diacritic}`), espaços → "-",
 *  só [a-z0-9-]. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyDraft(): SerializableReportDefinition {
  return { slug: "", name: "", columns: [] };
}

/** Cópia independente do rascunho — `SerializableReportDefinition` é JSON puro por definição
 *  (sem funções, sem `Date`), então o round-trip por `JSON` é uma cópia profunda segura. */
function cloneDefinition(definition: SerializableReportDefinition): SerializableReportDefinition {
  return JSON.parse(JSON.stringify(definition)) as SerializableReportDefinition;
}

type PatchDraft = (patch: Partial<SerializableReportDefinition>) => void;

// ---------- wrappers finos: reutilizam HeaderTab/StyleTab/SummaryTab do editor ----------

function DesignerHeaderTab(props: {
  draft: SerializableReportDefinition;
  onPatch: PatchDraft;
  globalConfig?: Partial<ReportGlobalConfig>;
  disabled: boolean;
  labels: CmReportDesignerLabels;
}): ReactElement {
  const { draft, onPatch, globalConfig, disabled, labels } = props;
  const view: ReportView = {
    id: "designer-draft",
    slug: draft.slug || "novo-relatorio",
    name: draft.name || labels.reportNamePlaceholder,
    isSystem: false,
    isDefault: false,
    header: draft.header,
  };

  return (
    <HeaderTab
      view={view}
      onViewChange={(nextView) => onPatch({ header: nextView.header })}
      globalConfig={globalConfig}
      disabled={disabled}
      labels={labels}
    />
  );
}

function DesignerStyleTab(props: {
  draft: SerializableReportDefinition;
  onPatch: PatchDraft;
  globalConfig?: Partial<ReportGlobalConfig>;
  disabled: boolean;
  labels: CmReportDesignerLabels;
}): ReactElement {
  const { draft, onPatch, globalConfig, disabled, labels } = props;
  const view: ReportView = {
    id: "designer-draft",
    slug: draft.slug || "novo-relatorio",
    name: draft.name || labels.reportNamePlaceholder,
    isSystem: false,
    isDefault: false,
    style: draft.style,
  };

  return (
    <StyleTab
      view={view}
      onViewChange={(nextView) => onPatch({ style: nextView.style })}
      globalConfig={globalConfig}
      disabled={disabled}
      labels={labels}
    />
  );
}

function DesignerSummaryTab(props: {
  draft: SerializableReportDefinition;
  onPatch: PatchDraft;
  disabled: boolean;
  labels: CmReportDesignerLabels;
}): ReactElement {
  const { draft, onPatch, disabled, labels } = props;
  const view: ReportView = {
    id: "designer-draft",
    slug: draft.slug || "novo-relatorio",
    name: draft.name || labels.reportNamePlaceholder,
    isSystem: false,
    isDefault: false,
    summary: draft.summary,
  };
  const sourceColumns = draft.columns.map((column) => ({ key: column.key, header: column.header }));

  return (
    <SummaryTab
      view={view}
      onViewChange={(nextView) => onPatch({ summary: nextView.summary })}
      sourceColumns={sourceColumns}
      disabled={disabled}
      labels={labels}
    />
  );
}

// ---------- aba Colunas própria do designer (SerializableReportColumn completas) ----------

const NUMERIC_FORMATS = new Set<ReportFormat>(["number", "integer", "currency", "percent"]);

function defaultAlignFor(format: ReportFormat | undefined): ReportColumnAlign {
  return format && NUMERIC_FORMATS.has(format) ? "right" : "left";
}

function sortBySortOrder(columns: SerializableReportColumn[]): SerializableReportColumn[] {
  return [...columns].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Reescreve `sortOrder` de todas as colunas conforme a ordem recebida (0..n-1). */
function withSequentialSortOrder(columns: SerializableReportColumn[]): SerializableReportColumn[] {
  return columns.map((column, index) => ({ ...column, sortOrder: index }));
}

function DesignerColumnsTab(props: {
  columns: SerializableReportColumn[];
  onColumnsChange: (columns: SerializableReportColumn[]) => void;
  disabled: boolean;
  labels: CmReportDesignerLabels;
}): ReactElement {
  const { columns, onColumnsChange, disabled, labels } = props;
  const ordered = sortBySortOrder(columns);

  function patchColumn(key: string, patch: Partial<Omit<SerializableReportColumn, "key">>): void {
    onColumnsChange(
      columns.map((column) => (column.key === key ? { ...column, ...patch } : column)),
    );
  }

  function move(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }
    const reordered = [...ordered];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onColumnsChange(withSequentialSortOrder(reordered));
  }

  function remove(key: string): void {
    onColumnsChange(withSequentialSortOrder(columns.filter((column) => column.key !== key)));
  }

  if (ordered.length === 0) {
    return <p className="cm-report-designer__columns-empty">{labels.columnsTabEmpty}</p>;
  }

  return (
    <div className="cm-report-editor__column-list">
      {ordered.map((column, index) => (
        <div
          key={column.key}
          className={
            (column.visible ?? true)
              ? "cm-report-editor__column-row"
              : "cm-report-editor__column-row cm-report-editor__column-row--hidden"
          }
        >
          {column.hideable !== false ? (
            <CmSwitch
              aria-label={`${labels.showColumn}: ${column.header}`}
              checked={column.visible ?? true}
              onCheckedChange={(checked) => patchColumn(column.key, { visible: checked })}
              disabled={disabled}
              className="cm-report-editor__column-visibility"
            />
          ) : (
            <span className="cm-report-editor__column-visibility-placeholder" aria-hidden="true" />
          )}

          <div className="cm-report-editor__column-header-field">
            <ColumnHeaderField
              value={column.header}
              onChange={(patch) => patchColumn(column.key, patch)}
              disabled={disabled}
              labels={labels}
            />
          </div>

          <div className="cm-report-editor__column-actions">
            <CmButton
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              icon={<CmIcon name="lucide:chevron-up" size={16} />}
              aria-label={labels.moveUp}
              title={labels.moveUp}
              onClick={() => move(index, -1)}
              disabled={disabled || index === 0}
            />
            <CmButton
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              icon={<CmIcon name="lucide:chevron-down" size={16} />}
              aria-label={labels.moveDown}
              title={labels.moveDown}
              onClick={() => move(index, 1)}
              disabled={disabled || index === ordered.length - 1}
            />
            <CmButton
              type="button"
              variant="ghost"
              tone="danger"
              size="sm"
              iconOnly
              icon={<CmIcon name="lucide:trash-2" size={16} />}
              aria-label={labels.removeColumnButton}
              title={labels.removeColumnButton}
              onClick={() => remove(column.key)}
              disabled={disabled}
            />
          </div>

          <div className="cm-report-editor__column-details">
            <ColumnWidthField
              value={column.width}
              onChange={(patch) => patchColumn(column.key, patch)}
              disabled={disabled}
              labels={labels}
            />
            <ColumnAlignField
              value={column.align ?? defaultAlignFor(column.format)}
              onChange={(patch) => patchColumn(column.key, patch)}
              disabled={disabled}
              labels={labels}
            />
            <ColumnFormatField
              value={column.format ?? "text"}
              onChange={(patch) => patchColumn(column.key, patch)}
              disabled={disabled}
              labels={labels}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- componente principal ----------

export function CmReportDesigner(props: CmReportDesignerProps): ReactElement {
  const {
    dataSources,
    adapter,
    definition,
    onSaved,
    onCancel,
    getPreviewRows,
    globalConfig,
    className,
    labels,
  } = props;

  const isEditMode = definition !== undefined;
  const mergedLabels: CmReportDesignerLabels = { ...defaultReportDesignerLabels, ...labels };

  const [draft, setDraft] = useState<SerializableReportDefinition>(() =>
    definition ? cloneDefinition(definition) : emptyDraft(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Uma vez que o usuário edite o slug manualmente (só possível em modo criação — em modo edição
  // o campo é `disabled`), o auto-slug a partir do nome para de sobrescrever o que foi digitado.
  const slugTouchedRef = useRef(isEditMode);

  const selectedDataSource = dataSources.find((source) => source.id === draft.dataSource);

  const [fetchedRows, setFetchedRows] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFetchedRows(null);

    if (!selectedDataSource || !getPreviewRows) {
      return;
    }

    getPreviewRows(selectedDataSource)
      .then((rows) => {
        if (!cancelled) setFetchedRows(rows);
      })
      .catch(() => {
        // Erro silencioso — sem linhas reais, o preview cai no fallback de
        // `generatePlaceholderRows` computado abaixo.
        if (!cancelled) setFetchedRows(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDataSource, getPreviewRows]);

  function patchDraft(patch: Partial<SerializableReportDefinition>): void {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleNameChange(value: string): void {
    setDraft((prev) => {
      const next: SerializableReportDefinition = { ...prev, name: value };
      if (!isEditMode && !slugTouchedRef.current) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  function handleSlugChange(value: string): void {
    slugTouchedRef.current = true;
    setDraft((prev) => ({ ...prev, slug: value }));
  }

  function handleDataSourceChange(id: string): void {
    setDraft((prev) => ({ ...prev, dataSource: id || undefined }));
  }

  function handleAddColumn(field: ReportDataSourceField): void {
    setDraft((prev) => {
      if (prev.columns.some((column) => column.key === field.key)) {
        return prev;
      }
      const column: SerializableReportColumn = {
        key: field.key,
        header: field.label,
        sortOrder: prev.columns.length,
      };
      if (field.format) {
        column.format = field.format;
      }
      return { ...prev, columns: [...prev.columns, column] };
    });
  }

  function handleGroupChange(group: SerializableReportDefinition["group"]): void {
    setDraft((prev) => {
      const next = { ...prev };
      if (group) {
        next.group = group;
      } else {
        delete next.group;
      }
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    setSaveError(null);

    if (!draft.name.trim()) {
      setValidationError(mergedLabels.validationNameRequired);
      return;
    }
    if (draft.columns.length === 0) {
      setValidationError(mergedLabels.validationColumnsRequired);
      return;
    }

    const parsed = parseReportDefinition(draft);
    if (!parsed) {
      setValidationError(mergedLabels.validationInvalidDefinition);
      return;
    }
    setValidationError(null);

    setIsSaving(true);
    try {
      await adapter.saveDefinition(parsed);
      onSaved?.(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : mergedLabels.saveErrorFallback;
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const tabsDisabled = !draft.dataSource && draft.columns.length === 0;
  const dataSourceOptions = dataSources.map((source) => ({ value: source.id, label: source.name }));

  const placeholderRows = generatePlaceholderRows(
    draft.columns.map((column) => ({ key: column.key, format: column.format })),
    20,
  );
  const previewRows = fetchedRows ?? placeholderRows;

  return (
    <div className={joinClassNames("cm-report-designer", className)}>
      {saveError ? (
        <CmAlert
          tone="danger"
          title={mergedLabels.saveErrorTitle}
          description={saveError}
          className="cm-report-designer__notice"
        />
      ) : null}
      {validationError ? (
        <CmAlert tone="warning" title={validationError} className="cm-report-designer__notice" />
      ) : null}

      <div className="cm-report-designer__header">
        <CmInput
          label={mergedLabels.reportNameLabel}
          placeholder={mergedLabels.reportNamePlaceholder}
          value={draft.name}
          onChange={(event) => handleNameChange(event.target.value)}
        />
        <CmInput
          label={mergedLabels.slugLabel}
          placeholder={mergedLabels.slugPlaceholder}
          value={draft.slug}
          onChange={(event) => handleSlugChange(event.target.value)}
          disabled={isEditMode}
        />
        <CmSelect
          label={mergedLabels.dataSourceLabel}
          placeholder={mergedLabels.dataSourcePlaceholder}
          value={draft.dataSource ?? ""}
          onChange={handleDataSourceChange}
          options={dataSourceOptions}
        />
      </div>

      <DataSourceStep
        dataSource={selectedDataSource}
        columns={draft.columns}
        onAddColumn={handleAddColumn}
        disabled={isSaving}
        labels={mergedLabels}
      />

      <div className="cm-report-designer__body">
        <div className="cm-report-designer__form">
          <CmTabs defaultValue="columns">
            <CmTabsList>
              <CmTabsTrigger value="columns" disabled={tabsDisabled}>
                {mergedLabels.tabColumns}
              </CmTabsTrigger>
              <CmTabsTrigger value="header" disabled={tabsDisabled}>
                {mergedLabels.tabHeader}
              </CmTabsTrigger>
              <CmTabsTrigger value="summary" disabled={tabsDisabled}>
                {mergedLabels.tabSummary}
              </CmTabsTrigger>
              <CmTabsTrigger value="style" disabled={tabsDisabled}>
                {mergedLabels.tabStyle}
              </CmTabsTrigger>
            </CmTabsList>

            {tabsDisabled ? (
              <CmEmpty
                title={mergedLabels.selectDataSourceEmptyTitle}
                description={mergedLabels.selectDataSourceEmptyDescription}
                className="cm-report-designer__empty"
              />
            ) : (
              <>
                <CmTabsContent value="columns">
                  <DesignerColumnsTab
                    columns={draft.columns}
                    onColumnsChange={(columns) => patchDraft({ columns })}
                    disabled={isSaving}
                    labels={mergedLabels}
                  />
                </CmTabsContent>

                <CmTabsContent value="header">
                  <DesignerHeaderTab
                    draft={draft}
                    onPatch={patchDraft}
                    globalConfig={globalConfig}
                    disabled={isSaving}
                    labels={mergedLabels}
                  />
                </CmTabsContent>

                <CmTabsContent value="summary">
                  <DesignerSummaryTab
                    draft={draft}
                    onPatch={patchDraft}
                    disabled={isSaving}
                    labels={mergedLabels}
                  />
                </CmTabsContent>

                <CmTabsContent value="style">
                  <DesignerStyleTab
                    draft={draft}
                    onPatch={patchDraft}
                    globalConfig={globalConfig}
                    disabled={isSaving}
                    labels={mergedLabels}
                  />
                </CmTabsContent>
              </>
            )}
          </CmTabs>

          {!tabsDisabled ? (
            <GroupSection
              columns={draft.columns}
              group={draft.group}
              onGroupChange={handleGroupChange}
              disabled={isSaving}
              labels={mergedLabels}
            />
          ) : null}
        </div>

        <div className="cm-report-designer__preview">
          <CmReportPdfPreview<Record<string, unknown>>
            definition={draft as ReportDefinition<Record<string, unknown>>}
            rows={previewRows}
            globalConfig={globalConfig}
          />
        </div>
      </div>

      <div className="cm-report-designer__footer">
        {onCancel ? (
          <CmButton type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {mergedLabels.cancelButton}
          </CmButton>
        ) : null}
        <CmButton type="button" tone="primary" onClick={handleSave} loading={isSaving}>
          {mergedLabels.saveButton}
        </CmButton>
      </div>
    </div>
  );
}
