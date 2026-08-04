"use client";

// StyleTab — aba "Estilo" do editor: tamanho de fonte, zebra/grade, densidade e cor de destaque.
// Mesma precedência de exibição do `resolveReport` (view > definição > globalConfig > default,
// ver `HeaderTab`); cada edição grava um patch raso em `view.style`. `accentColor` usa
// `<input type="color">` nativo — o cosmemilton-ui não tem um color picker.
import type { ReactElement } from "react";
import { CmField, CmInput, CmSelect, CmSwitch } from "cosmemilton-ui/client";
import { defaultReportStyle } from "../../core/defaults.js";
import type { ReportGlobalConfig, ReportStyleConfig, ReportView } from "../../core/types.js";
import type { CmReportLayoutEditorLabels } from "./labels.js";

export type StyleTabProps = {
  view: ReportView;
  onViewChange: (view: ReportView) => void;
  /** `definition.style` — só o campo (ver `HeaderTab` para o mesmo raciocínio). */
  definitionStyle?: ReportStyleConfig;
  globalConfig?: Partial<ReportGlobalConfig>;
  disabled: boolean;
  labels: CmReportLayoutEditorLabels;
};

function styleField<K extends keyof ReportStyleConfig>(
  key: K,
  layers: (ReportStyleConfig | undefined)[],
): Required<ReportStyleConfig>[K] {
  for (const layer of layers) {
    const value = layer?.[key];
    if (value !== undefined) {
      return value as Required<ReportStyleConfig>[K];
    }
  }
  return defaultReportStyle[key];
}

export function StyleTab(props: StyleTabProps): ReactElement {
  const { view, onViewChange, definitionStyle, globalConfig, disabled, labels } = props;
  const layers = [view.style, definitionStyle, globalConfig?.style];

  function patchStyle(patch: Partial<ReportStyleConfig>): void {
    onViewChange({ ...view, style: { ...view.style, ...patch } });
  }

  const densityOptions = [
    { value: "compact", label: labels.densityCompact },
    { value: "normal", label: labels.densityNormal },
    { value: "relaxed", label: labels.densityRelaxed },
  ];

  const fontSize = styleField("fontSize", layers);
  const headerFontSize = styleField("headerFontSize", layers);
  const zebraStripes = styleField("zebraStripes", layers);
  const showGridLines = styleField("showGridLines", layers);
  const density = styleField("density", layers);
  const accentColor = styleField("accentColor", layers);

  return (
    <div className="cm-report-editor__style-grid">
      <CmInput
        label={labels.styleFontSize}
        numeric="integer"
        value={String(fontSize)}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) patchStyle({ fontSize: parsed });
        }}
        disabled={disabled}
      />
      <CmInput
        label={labels.styleHeaderFontSize}
        numeric="integer"
        value={String(headerFontSize)}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) patchStyle({ headerFontSize: parsed });
        }}
        disabled={disabled}
      />

      <CmField label={labels.styleZebraStripes} className="cm-report-editor__switch-field">
        <CmSwitch
          aria-label={labels.styleZebraStripes}
          checked={zebraStripes}
          onCheckedChange={(checked) => patchStyle({ zebraStripes: checked })}
          disabled={disabled}
        />
      </CmField>

      <CmField label={labels.styleShowGridLines} className="cm-report-editor__switch-field">
        <CmSwitch
          aria-label={labels.styleShowGridLines}
          checked={showGridLines}
          onCheckedChange={(checked) => patchStyle({ showGridLines: checked })}
          disabled={disabled}
        />
      </CmField>

      <CmSelect
        label={labels.styleDensity}
        value={density}
        onChange={(value) => patchStyle({ density: value as ReportStyleConfig["density"] })}
        options={densityOptions}
        disabled={disabled}
      />

      <label className="cm-report-editor__color-field">
        <span className="cm-report-editor__color-label">{labels.styleAccentColor}</span>
        <input
          type="color"
          className="cm-report-editor__color-input"
          value={accentColor}
          onChange={(event) => patchStyle({ accentColor: event.target.value })}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
