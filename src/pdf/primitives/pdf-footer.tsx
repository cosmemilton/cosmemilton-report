import { Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ResolvedReport } from "../../core/types.js";
import { mmToPt } from "../map-columns.js";

export type ReportPdfFooterProps<T> = {
  resolved: ResolvedReport<T>;
  footerText?: string;
  /** A composição sequencial já conhece os números globais na etapa de rodapé. */
  pageNumbers?: { pageNumber: number; totalPages: number };
};

/** Mesmo rodapé para o documento contínuo, a bobina e a sobreposição após o merge. */
export function ReportPdfFooter<T>({
  resolved,
  footerText,
  pageNumbers,
}: ReportPdfFooterProps<T>): ReactElement {
  const { page, style, header } = resolved;
  const thermal = page.paperSize === "58mm" || page.paperSize === "80mm";
  return (
    <View
      fixed={!thermal}
      wrap={false}
      style={{
        ...(thermal
          ? { marginTop: 8 }
          : {
              position: "absolute",
              bottom: Math.max(mmToPt(page.marginBottomMm) - 16, 8),
              left: mmToPt(page.marginLeftMm),
              right: mmToPt(page.marginRightMm),
            }),
        flexDirection: thermal ? "column" : "row",
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
        pageNumbers ? (
          <Text>{`Página ${pageNumbers.pageNumber} de ${pageNumbers.totalPages}`}</Text>
        ) : (
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        )
      ) : null}
    </View>
  );
}
