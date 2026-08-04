"use client";

// GroupSection — seção "Agrupamento" do designer: `CmSelect` com as colunas atuais do rascunho
// (+ "Nenhum") e `CmSwitch` de subtotal. Selecionar "Nenhum" remove o agrupamento (`onGroupChange
// (undefined)`); selecionar uma coluna escreve `{ by, showSubtotal }`, preservando o
// `showSubtotal` já escolhido (ou `true` por padrão). O switch de subtotal fica desabilitado
// quando não há coluna de agrupamento escolhida — não faz sentido configurar o subtotal de um
// agrupamento inexistente.
import type { ReactElement } from "react";
import { CmSelect, CmSwitch } from "cosmemilton-ui/client";
import type { SerializableReportColumn, SerializableReportDefinition } from "../../core/types.js";
import type { CmReportDesignerLabels } from "./labels.js";

export type GroupSectionProps = {
  columns: SerializableReportColumn[];
  group: SerializableReportDefinition["group"];
  onGroupChange: (group: SerializableReportDefinition["group"]) => void;
  disabled?: boolean;
  labels: CmReportDesignerLabels;
};

const NONE_VALUE = "";

export function GroupSection(props: GroupSectionProps): ReactElement {
  const { columns, group, onGroupChange, disabled, labels } = props;

  const options = [
    { value: NONE_VALUE, label: labels.groupByNone },
    ...columns.map((column) => ({ value: column.key, label: column.header })),
  ];

  function handleByChange(value: string): void {
    if (value === NONE_VALUE) {
      onGroupChange(undefined);
      return;
    }
    onGroupChange({ by: value, showSubtotal: group?.showSubtotal ?? true });
  }

  function handleSubtotalChange(checked: boolean): void {
    if (!group) {
      return;
    }
    onGroupChange({ ...group, showSubtotal: checked });
  }

  return (
    <div className="cm-report-designer__group">
      <h3 className="cm-report-designer__group-title">{labels.groupSectionTitle}</h3>
      <div className="cm-report-designer__group-fields">
        <CmSelect
          label={labels.groupByLabel}
          value={group?.by ?? NONE_VALUE}
          onChange={handleByChange}
          options={options}
          disabled={disabled}
        />
        <div className="cm-report-editor__switch-list">
          <div className="cm-report-editor__switch-row">
            <span className="cm-report-editor__switch-row-label">{labels.groupShowSubtotal}</span>
            <CmSwitch
              aria-label={labels.groupShowSubtotal}
              checked={group?.showSubtotal ?? true}
              onCheckedChange={handleSubtotalChange}
              disabled={disabled || !group}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
