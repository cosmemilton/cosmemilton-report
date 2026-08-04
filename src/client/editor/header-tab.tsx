"use client";

// HeaderTab — aba "Cabeçalho" do editor: título/subtítulo e switches de exibição. Os valores
// exibidos seguem a mesma precedência do `resolveReport` (view > definição > globalConfig >
// default) para que uma view sem overrides (ex.: a view "system", provisionada sem
// `header`/`style`) já mostre corretamente o que a definição de código configura — mas cada
// edição grava só um patch raso em `view.header`, nunca a definição.
import type { ReactElement } from "react";
import { CmField, CmInput, CmSwitch } from "cosmemilton-ui/client";
import { defaultReportHeader } from "../../core/defaults.js";
import type { ReportGlobalConfig, ReportHeaderConfig, ReportView } from "../../core/types.js";
import type { CmReportLayoutEditorLabels } from "./labels.js";

export type HeaderTabProps = {
  view: ReportView;
  onViewChange: (view: ReportView) => void;
  /** `definition.header` — só o campo, para não amarrar este componente ao tipo genérico
   *  `ReportDefinition<T>` (que não é necessário aqui). */
  definitionHeader?: ReportHeaderConfig;
  globalConfig?: Partial<ReportGlobalConfig>;
  disabled: boolean;
  labels: CmReportLayoutEditorLabels;
};

function headerField<K extends keyof ReportHeaderConfig>(
  key: K,
  layers: (ReportHeaderConfig | undefined)[],
): Required<ReportHeaderConfig>[K] {
  for (const layer of layers) {
    const value = layer?.[key];
    if (value !== undefined) {
      return value as Required<ReportHeaderConfig>[K];
    }
  }
  return defaultReportHeader[key];
}

type HeaderSwitchField =
  "showLogo" | "showCompanyName" | "showGeneratedAt" | "showUserName" | "showPageNumbers";

export function HeaderTab(props: HeaderTabProps): ReactElement {
  const { view, onViewChange, definitionHeader, globalConfig, disabled, labels } = props;
  const layers = [view.header, definitionHeader, globalConfig?.header];

  function patchHeader(patch: Partial<ReportHeaderConfig>): void {
    onViewChange({ ...view, header: { ...view.header, ...patch } });
  }

  const switches: { field: HeaderSwitchField; label: string }[] = [
    { field: "showLogo", label: labels.headerShowLogo },
    { field: "showCompanyName", label: labels.headerShowCompanyName },
    { field: "showGeneratedAt", label: labels.headerShowGeneratedAt },
    { field: "showUserName", label: labels.headerShowUserName },
    { field: "showPageNumbers", label: labels.headerShowPageNumbers },
  ];

  return (
    <div className="cm-report-editor__header-grid">
      <CmInput
        label={labels.headerTitle}
        placeholder={labels.headerTitlePlaceholder}
        value={headerField("title", layers)}
        onChange={(event) => patchHeader({ title: event.target.value })}
        disabled={disabled}
      />
      <CmInput
        label={labels.headerSubtitle}
        placeholder={labels.headerSubtitlePlaceholder}
        value={headerField("subtitle", layers)}
        onChange={(event) => patchHeader({ subtitle: event.target.value })}
        disabled={disabled}
      />

      <div className="cm-report-editor__switch-list">
        {switches.map(({ field, label }) => (
          <CmField key={field} label={label} className="cm-report-editor__switch-field">
            <CmSwitch
              aria-label={label}
              checked={headerField(field, layers)}
              onCheckedChange={(checked) =>
                patchHeader({ [field]: checked } as Partial<ReportHeaderConfig>)
              }
              disabled={disabled}
            />
          </CmField>
        ))}
      </div>
    </div>
  );
}
