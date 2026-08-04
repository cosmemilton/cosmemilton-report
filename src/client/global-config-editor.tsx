"use client";

// CmReportGlobalConfigEditor — painel de configuração GLOBAL de relatórios: branding (logotipo e
// nome da empresa), página (papel, orientação, margens) e rodapé. É a camada `globalConfig` do
// `resolveReport` — vale para TODOS os relatórios do app, enquanto o `CmReportLayoutEditor` cuida
// da view de UM relatório. Controlado: `value` (parcial) + `onChange(patch)` com patches rasos;
// quem persiste (adapter.saveGlobalConfig, banco, etc.) é o app.
//
// O logotipo aceita URL/data-URI digitado OU upload de arquivo de imagem, convertido para data URI
// via FileReader — data URI funciona igual no PDF (server e client) sem depender de hospedagem.
// O `<input type="file">` nativo fica oculto e é acionado por um CmButton (mesma abordagem do
// `<input type="color">` no StyleTab: o cosmemilton-ui não tem primitivo para isso).
import { useRef, type ReactElement } from "react";
import { CmButton, CmInput, CmSelect, CmSwitch } from "cosmemilton-ui/client";
import { CmIcon } from "cosmemilton-ui/server";
import type { ReportGlobalConfig, ReportOrientation, ReportPaperSize } from "../core/types.js";

export type CmReportGlobalConfigEditorLabels = {
  brandingSection: string;
  companyName: string;
  companyNamePlaceholder: string;
  logoUrl: string;
  logoUrlPlaceholder: string;
  logoUpload: string;
  logoClear: string;
  logoPreviewAlt: string;
  showLogo: string;
  showCompanyName: string;
  pageSection: string;
  paperSize: string;
  paperA4: string;
  paperLetter: string;
  orientation: string;
  orientationPortrait: string;
  orientationLandscape: string;
  marginsSection: string;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  footerText: string;
  footerTextPlaceholder: string;
};

export const defaultReportGlobalConfigEditorLabels: CmReportGlobalConfigEditorLabels = {
  brandingSection: "Identidade",
  companyName: "Nome da empresa",
  companyNamePlaceholder: "Ex.: Minha Empresa LTDA",
  logoUrl: "Logotipo (URL ou data URI)",
  logoUrlPlaceholder: "https://… ou data:image/png;base64,…",
  logoUpload: "Enviar imagem",
  logoClear: "Remover logotipo",
  logoPreviewAlt: "Pré-visualização do logotipo",
  showLogo: "Exibir logotipo nos relatórios",
  showCompanyName: "Exibir nome da empresa",
  pageSection: "Página",
  paperSize: "Papel",
  paperA4: "A4",
  paperLetter: "Carta (Letter)",
  orientation: "Orientação",
  orientationPortrait: "Retrato",
  orientationLandscape: "Paisagem",
  marginsSection: "Margens (mm)",
  marginTop: "Superior",
  marginBottom: "Inferior",
  marginLeft: "Esquerda",
  marginRight: "Direita",
  footerText: "Texto do rodapé",
  footerTextPlaceholder: "Ex.: CNPJ 00.000.000/0001-00 · www.minhaempresa.com.br",
};

export type CmReportGlobalConfigEditorProps = {
  /** Config atual (parcial — campos ausentes herdam os defaults da lib). */
  value: Partial<ReportGlobalConfig>;
  /** Recebe um patch raso; quem chama mescla (`{ ...value, ...patch }`) e persiste. */
  onChange: (patch: Partial<ReportGlobalConfig>) => void;
  disabled?: boolean;
  className?: string;
  labels?: Partial<CmReportGlobalConfigEditorLabels>;
};

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type MarginField = "marginTopMm" | "marginBottomMm" | "marginLeftMm" | "marginRightMm";

const MARGIN_DEFAULTS: Record<MarginField, number> = {
  marginTopMm: 15,
  marginBottomMm: 15,
  marginLeftMm: 10,
  marginRightMm: 10,
};

export function CmReportGlobalConfigEditor(props: CmReportGlobalConfigEditorProps): ReactElement {
  const { value, onChange, disabled, className, labels } = props;
  const l: CmReportGlobalConfigEditorLabels = {
    ...defaultReportGlobalConfigEditorLabels,
    ...labels,
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleLogoFile(file: File | undefined): void {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange({ logoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  const margins: { field: MarginField; label: string }[] = [
    { field: "marginTopMm", label: l.marginTop },
    { field: "marginBottomMm", label: l.marginBottom },
    { field: "marginLeftMm", label: l.marginLeft },
    { field: "marginRightMm", label: l.marginRight },
  ];

  const paperOptions = [
    { value: "A4", label: l.paperA4 },
    { value: "Letter", label: l.paperLetter },
  ];
  const orientationOptions = [
    { value: "portrait", label: l.orientationPortrait },
    { value: "landscape", label: l.orientationLandscape },
  ];

  return (
    <div className={joinClassNames("cm-report-config", className)}>
      <p className="cm-report-config__section-title">
        <CmIcon name="lucide:building-2" size={14} /> {l.brandingSection}
      </p>

      <div className="cm-report-config__grid">
        <CmInput
          label={l.companyName}
          placeholder={l.companyNamePlaceholder}
          value={value.companyName ?? ""}
          onChange={(event) => onChange({ companyName: event.target.value })}
          disabled={disabled}
        />

        <div className="cm-report-config__logo-row">
          <div className="cm-report-config__logo-url">
            <CmInput
              label={l.logoUrl}
              placeholder={l.logoUrlPlaceholder}
              value={value.logoUrl ?? ""}
              onChange={(event) => onChange({ logoUrl: event.target.value || undefined })}
              disabled={disabled}
            />
          </div>
          <CmButton
            type="button"
            variant="outline"
            icon={<CmIcon name="lucide:image-up" size={16} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            {l.logoUpload}
          </CmButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="cm-report-config__file-input"
            aria-label={l.logoUpload}
            onChange={(event) => {
              handleLogoFile(event.target.files?.[0]);
              event.target.value = "";
            }}
            disabled={disabled}
          />
        </div>
      </div>

      {value.logoUrl ? (
        <div className="cm-report-config__logo-preview">
          {/* <img> nativo de propósito: preview simples de data URI/URL, sem otimizador de framework. */}
          <img
            src={value.logoUrl}
            alt={l.logoPreviewAlt}
            className="cm-report-config__logo-image"
          />
          <CmButton
            type="button"
            variant="ghost"
            tone="danger"
            size="sm"
            iconOnly
            icon={<CmIcon name="lucide:trash-2" size={16} />}
            aria-label={l.logoClear}
            title={l.logoClear}
            onClick={() => onChange({ logoUrl: undefined })}
            disabled={disabled}
          />
        </div>
      ) : null}

      <div className="cm-report-editor__switch-list">
        <div className="cm-report-editor__switch-row">
          <span className="cm-report-editor__switch-row-label">{l.showLogo}</span>
          <CmSwitch
            aria-label={l.showLogo}
            checked={value.showLogo ?? true}
            onCheckedChange={(checked) => onChange({ showLogo: checked })}
            disabled={disabled}
          />
        </div>
        <div className="cm-report-editor__switch-row">
          <span className="cm-report-editor__switch-row-label">{l.showCompanyName}</span>
          <CmSwitch
            aria-label={l.showCompanyName}
            checked={value.showCompanyName ?? true}
            onCheckedChange={(checked) => onChange({ showCompanyName: checked })}
            disabled={disabled}
          />
        </div>
      </div>

      <p className="cm-report-config__section-title">
        <CmIcon name="lucide:file" size={14} /> {l.pageSection}
      </p>

      <div className="cm-report-config__grid">
        <CmSelect
          label={l.paperSize}
          value={value.paperSize ?? "A4"}
          onChange={(next) => onChange({ paperSize: next as ReportPaperSize })}
          options={paperOptions}
          disabled={disabled}
        />
        <CmSelect
          label={l.orientation}
          value={value.orientation ?? "portrait"}
          onChange={(next) => onChange({ orientation: next as ReportOrientation })}
          options={orientationOptions}
          disabled={disabled}
        />
        <CmInput
          label={l.footerText}
          placeholder={l.footerTextPlaceholder}
          value={value.footerText ?? ""}
          onChange={(event) => onChange({ footerText: event.target.value || undefined })}
          disabled={disabled}
        />
      </div>

      <p className="cm-report-config__section-title">
        <CmIcon name="lucide:ruler" size={14} /> {l.marginsSection}
      </p>

      <div className="cm-report-config__margins">
        {margins.map(({ field, label }) => (
          <CmInput
            key={field}
            label={label}
            numeric="integer"
            value={String(value[field] ?? MARGIN_DEFAULTS[field])}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(parsed) && parsed >= 0) {
                onChange({ [field]: parsed });
              }
            }}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
