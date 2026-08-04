// pdf-document.tsx — moldura de página do PDF: <Document><Page> com margens mm→pt, cabeçalho e
// rodapé `fixed` (repetem em toda página) envolvendo o conteúdo do relatório (`children`).
// Componente interno: não é exportado no barrel `src/pdf.ts` (ponto de extensão é
// `createReportDocument`, em `../create-document.js`).
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import type { ResolvedReport } from "../../core/types.js";
import { mmToPt, paperSizeToReactPdf } from "../map-columns.js";

export type ReportPdfDocumentProps<T> = {
  resolved: ResolvedReport<T>;
  generatedAt: Date;
  userName?: string;
  /** Texto do rodapé, à esquerda. Vem de `ReportGlobalConfig.footerText` — não faz parte de
   *  `ResolvedReport` porque não é uma configuração sobreponível por definição/view/overrides,
   *  então `createReportDocument` o repassa direto do `globalConfig` de entrada. */
  footerText?: string;
  children: ReactNode;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formata como "dd/mm/aaaa hh:mm". */
function formatGeneratedAt(date: Date): string {
  const day = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `${day} ${time}`;
}

/**
 * Moldura comum a todo relatório em PDF — usada tanto pelo render server
 * (`renderReportToBuffer`/`renderReportToStream`) quanto pelo preview client (fase 9).
 *
 * Logo e nome da empresa só aparecem quando o toggle de cabeçalho DESTE relatório (`header.*`,
 * sobreponível por definição/view/overrides) E o toggle global (`branding.*`, só vindo de
 * `globalConfig`) concordam, e o dado (`logoUrl`/`companyName`) realmente existe.
 */
export function ReportPdfDocument<T>({
  resolved,
  generatedAt,
  userName,
  footerText,
  children,
}: ReportPdfDocumentProps<T>): ReactElement {
  const { header, branding, page, style, title, subtitle, fontFamily } = resolved;

  const logoSrc = header.showLogo && branding.showLogo ? branding.logoUrl : undefined;
  const companyName =
    header.showCompanyName && branding.showCompanyName ? branding.companyName : undefined;

  return (
    <Document title={title}>
      <Page
        size={paperSizeToReactPdf(page.paperSize)}
        orientation={page.orientation}
        style={{
          paddingTop: mmToPt(page.marginTopMm),
          paddingBottom: mmToPt(page.marginBottomMm),
          paddingLeft: mmToPt(page.marginLeftMm),
          paddingRight: mmToPt(page.marginRightMm),
          fontSize: style.fontSize,
          fontFamily: fontFamily || "Helvetica",
        }}
      >
        <View
          fixed
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: style.accentColor,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {logoSrc ? (
              <Image src={logoSrc} style={{ width: 32, height: 32, marginRight: 8 }} />
            ) : null}
            <View>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: style.accentColor }}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {companyName ? (
              <Text style={{ fontSize: style.fontSize, color: "#374151" }}>{companyName}</Text>
            ) : null}
            {header.showGeneratedAt ? (
              <Text style={{ fontSize: style.fontSize, color: "#6b7280", marginTop: 2 }}>
                Gerado em {formatGeneratedAt(generatedAt)}
              </Text>
            ) : null}
            {header.showUserName && userName ? (
              <Text style={{ fontSize: style.fontSize, color: "#6b7280", marginTop: 2 }}>
                {userName}
              </Text>
            ) : null}
          </View>
        </View>

        {children}

        <View
          fixed
          style={{
            position: "absolute",
            bottom: Math.max(mmToPt(page.marginBottomMm) - 16, 8),
            left: mmToPt(page.marginLeftMm),
            right: mmToPt(page.marginRightMm),
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: 4,
            borderTopWidth: 0.5,
            borderTopColor: "#d1d5db",
            fontSize: Math.max(style.fontSize - 1, 6),
            color: "#6b7280",
          }}
        >
          <Text>{footerText ?? ""}</Text>
          {header.showPageNumbers ? (
            <Text
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
