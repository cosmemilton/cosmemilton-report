"use client";

// ColumnsTab — aba "Colunas" do editor: lista as colunas na ordem EFETIVA (merge definição+view
// via `resolveColumns`, reaproveitado do core), com visibilidade, rótulo, largura, alinhamento,
// formato e reordenação (subir/descer). Toda edição sai por `onViewChange` como overrides
// serializáveis (`ReportViewColumn[]`) — nunca a coluna inteira da definição.
import type { ReactElement } from "react";
import { CmButton, CmSwitch } from "cosmemilton-ui/client";
import { CmIcon } from "cosmemilton-ui/server";
import { resolveColumns } from "../../core/columns.js";
import type { ReportDefinition, ReportView, ReportViewColumn } from "../../core/types.js";
import {
  ColumnAlignField,
  ColumnFormatField,
  ColumnHeaderField,
  ColumnWidthField,
} from "./column-fields.js";
import type { CmReportLayoutEditorLabels } from "./labels.js";

export type ColumnsTabProps<T> = {
  definition: ReportDefinition<T>;
  view: ReportView;
  onViewChange: (view: ReportView) => void;
  disabled: boolean;
  labels: CmReportLayoutEditorLabels;
};

/** Upsert do override de `key` em `view.columns`: mescla com o override existente (se houver) em
 *  vez de substituí-lo, para não perder outras edições já feitas na mesma coluna. */
function updateViewColumn(
  view: ReportView,
  key: string,
  patch: Partial<Omit<ReportViewColumn, "key">>,
): ReportViewColumn[] {
  const existing = view.columns ?? [];
  const index = existing.findIndex((column) => column.key === key);

  if (index === -1) {
    return [...existing, { key, ...patch }];
  }

  const next = [...existing];
  next[index] = { ...next[index], ...patch };
  return next;
}

/** Reescreve `sortOrder` de TODAS as colunas conforme a nova ordem (`orderedKeys`, 0..n-1),
 *  preservando os demais overrides já existentes de cada coluna. */
function reorderViewColumns(view: ReportView, orderedKeys: string[]): ReportViewColumn[] {
  const existingByKey = new Map((view.columns ?? []).map((column) => [column.key, column]));

  return orderedKeys.map((key, index) => ({
    ...(existingByKey.get(key) ?? { key }),
    sortOrder: index,
  }));
}

/** `widthPct <= 0` é o marcador interno do core para "sem largura explícita" (ver
 *  `resolveColumns`) — o campo mostra vazio nesse caso, em vez de "0%". */
function widthOverride(widthPct: number): `${number}%` | undefined {
  return widthPct > 0 ? (`${widthPct}%` as const) : undefined;
}

export function ColumnsTab<T>(props: ColumnsTabProps<T>): ReactElement {
  const { definition, view, onViewChange, disabled, labels } = props;

  const columns = resolveColumns(definition.columns, view.columns).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const orderedKeys = columns.map((column) => column.key);

  function move(index: number, direction: -1 | 1): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedKeys.length) {
      return;
    }
    const nextOrder = [...orderedKeys];
    [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
    onViewChange({ ...view, columns: reorderViewColumns(view, nextOrder) });
  }

  function patchColumn(key: string, patch: Partial<Omit<ReportViewColumn, "key">>): void {
    onViewChange({ ...view, columns: updateViewColumn(view, key, patch) });
  }

  return (
    <div className="cm-report-editor__column-list">
      {columns.map((column, index) => (
        <div
          key={column.key}
          className={
            column.visible
              ? "cm-report-editor__column-row"
              : "cm-report-editor__column-row cm-report-editor__column-row--hidden"
          }
        >
          {column.hideable ? (
            <CmSwitch
              aria-label={`${labels.showColumn}: ${column.header}`}
              checked={column.visible}
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
              disabled={disabled || index === columns.length - 1}
            />
          </div>

          <div className="cm-report-editor__column-details">
            <ColumnWidthField
              value={widthOverride(column.widthPct)}
              onChange={(patch) => patchColumn(column.key, patch)}
              disabled={disabled}
              labels={labels}
            />
            <ColumnAlignField
              value={column.align}
              onChange={(patch) => patchColumn(column.key, patch)}
              disabled={disabled}
              labels={labels}
            />
            <ColumnFormatField
              value={column.format}
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
