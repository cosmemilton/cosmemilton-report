// pdf-document.tsx — moldura de página do PDF: <Document><Page> com margens mm→pt, cabeçalho e
// rodapé `fixed` (repetem em toda página) envolvendo os blocos de conteúdo do relatório.
// Componente interno: não é exportado no barrel `src/pdf.ts` (ponto de extensão é
// `createReportDocument`, em `../create-document.js`).
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { ReactElement, ReactNode } from "react";
import type { ResolvedReport } from "../../core/types.js";
import { mmToPt, paperSizeToReactPdf } from "../map-columns.js";
import { ReportPdfFooter } from "./pdf-footer.js";

export type ReportPdfDocumentProps<T> = {
  resolved: ResolvedReport<T>;
  generatedAt: Date;
  userName?: string;
  /** Texto do rodapé, à esquerda. Vem de `ReportGlobalConfig.footerText` — não faz parte de
   *  `ResolvedReport` porque não é uma configuração sobreponível por definição/view/overrides,
   *  então `createReportDocument` o repassa direto do `globalConfig` de entrada. */
  footerText?: string;
  /** Cada bloco inicia um Page; o renderer pode subdividi-lo conforme a altura real. */
  blocks: ReactNode[];
  renderFooter?: boolean;
};

function pageStyle<T>(resolved: ResolvedReport<T>) {
  const { page, style, fontFamily } = resolved;
  return {
    paddingTop: mmToPt(page.marginTopMm),
    paddingBottom: mmToPt(page.marginBottomMm),
    paddingLeft: mmToPt(page.marginLeftMm),
    paddingRight: mmToPt(page.marginRightMm),
    fontSize: style.fontSize,
    fontFamily: fontFamily || "Helvetica",
  };
}

/** Páginas transparentes só com rodapé; a geometria vem do PDF já paginado. */
export function createReportFooterDocument<T>(
  resolved: ResolvedReport<T>,
  footerText: string | undefined,
  pages: { width: number; height: number; pageNumber: number }[],
  totalPages: number,
): ReactElement {
  return (
    <Document>
      {pages.map(({ width, height, pageNumber }) => (
        // Keep pagination enabled: React PDF assigns the physical page height during
        // pagination. With wrap=false an absolute-only page shrinks to its padding.
        <Page key={pageNumber} size={{ width, height }} style={pageStyle(resolved)}>
          <ReportPdfFooter
            resolved={resolved}
            footerText={footerText}
            pageNumbers={{ pageNumber, totalPages }}
          />
        </Page>
      ))}
    </Document>
  );
}

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
  blocks,
  renderFooter = true,
}: ReportPdfDocumentProps<T>): ReactElement {
  const { header, branding, page, style, title, subtitle } = resolved;
  const thermal = page.paperSize === "58mm" || page.paperSize === "80mm";

  const logoSrc = header.showLogo && branding.showLogo ? branding.logoUrl : undefined;
  const companyName =
    header.showCompanyName && branding.showCompanyName ? branding.companyName : undefined;

  return (
    <Document title={title}>
      {blocks.map((content, index) => (
        <Page
          key={index}
          size={paperSizeToReactPdf(page.paperSize)}
          orientation={page.orientation}
          wrap={!thermal}
          style={pageStyle(resolved)}
        >
          <View
            fixed
            style={{
              flexDirection: thermal ? "column" : "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: thermal ? 6 : 12,
              paddingBottom: thermal ? 4 : 8,
              borderBottomWidth: 1,
              borderBottomColor: style.accentColor,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
              {logoSrc ? (
                <Image src={logoSrc} style={{ width: 32, height: 32, marginRight: 8 }} />
              ) : null}
              <View style={{ flexShrink: 1 }}>
                <Text
                  style={{
                    fontSize: thermal ? 11 : 16,
                    fontWeight: "bold",
                    color: style.accentColor,
                  }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={{ fontSize: thermal ? 8 : 10, color: "#4b5563", marginTop: 2 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
            <View
              style={{
                alignItems: thermal ? "flex-start" : "flex-end",
                marginTop: thermal ? 4 : 0,
              }}
            >
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

          {content}

          {renderFooter ? <ReportPdfFooter resolved={resolved} footerText={footerText} /> : null}
        </Page>
      ))}
    </Document>
  );
}
