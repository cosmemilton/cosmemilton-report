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
import { CmButton, CmInput, CmSelect, CmSwitch, useCmToast } from "cosmemilton-ui/client";
import { CmIcon } from "cosmemilton-ui/server";
import { getReportPageDefaults } from "../core/defaults.js";
import type { ReportGlobalConfig, ReportOrientation, ReportPaperSize } from "../core/types.js";

export type CmReportGlobalConfigEditorLabels = {
  brandingSection: string;
  companyName: string;
  companyNamePlaceholder: string;
  logoUrl: string;
  logoUrlPlaceholder: string;
  logoUpload: string;
  logoUploadSuccess: string;
  logoInvalidFile: string;
  logoReadError: string;
  logoClear: string;
  logoPreviewAlt: string;
  showLogo: string;
  showCompanyName: string;
  pageSection: string;
  paperSize: string;
  paperA4: string;
  paperLetter: string;
  paper58mm: string;
  paper80mm: string;
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
  logoUploadSuccess: "Logotipo carregado.",
  logoInvalidFile: "Selecione um arquivo de imagem.",
  logoReadError: "Não foi possível carregar a imagem. Tente novamente.",
  logoClear: "Remover logotipo",
  logoPreviewAlt: "Pré-visualização do logotipo",
  showLogo: "Exibir logotipo nos relatórios",
  showCompanyName: "Exibir nome da empresa",
  pageSection: "Página",
  paperSize: "Papel",
  paperA4: "A4",
  paperLetter: "Carta (Letter)",
  paper58mm: "Bobina 58 mm (PDV)",
  paper80mm: "Bobina 80 mm (PDV)",
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

/** Requer um `CmToastProvider` ancestral para o feedback do upload de logotipo. */
export function CmReportGlobalConfigEditor(props: CmReportGlobalConfigEditorProps): ReactElement {
  const { value, onChange, disabled, className, labels } = props;
  const l: CmReportGlobalConfigEditorLabels = {
    ...defaultReportGlobalConfigEditorLabels,
    ...labels,
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useCmToast();
  const paperSize = value.paperSize ?? "A4";
  const isThermalPaper = paperSize === "58mm" || paperSize === "80mm";
  const pageDefaults = getReportPageDefaults(paperSize);

  function handleLogoFile(file: File | undefined): void {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast(l.logoInvalidFile, { tone: "danger" });
      return;
    }
    const onReadError = () => {
      toast(l.logoReadError, { tone: "danger" });
    };
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
          onReadError();
          return;
        }
        onChange({ logoUrl: reader.result });
        toast(l.logoUploadSuccess, { tone: "success" });
      };
      reader.onerror = onReadError;
      reader.onabort = onReadError;
      reader.readAsDataURL(file);
    } catch {
      onReadError();
    }
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
    { value: "58mm", label: l.paper58mm },
    { value: "80mm", label: l.paper80mm },
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
          value={paperSize}
          onChange={(next) =>
            onChange({
              paperSize: next as ReportPaperSize,
              ...(next === "58mm" || next === "80mm" ? { orientation: "portrait" } : {}),
            })
          }
          options={paperOptions}
          disabled={disabled}
        />
        <CmSelect
          label={l.orientation}
          value={isThermalPaper ? "portrait" : (value.orientation ?? "portrait")}
          onChange={(next) => onChange({ orientation: next as ReportOrientation })}
          options={orientationOptions}
          disabled={disabled || isThermalPaper}
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
            value={String(value[field] ?? pageDefaults[field])}
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
