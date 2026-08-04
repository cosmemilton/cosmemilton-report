// pdf-summary.tsx — bloco de sumário ao final do relatório: cada `ReportComputedSummaryItem`
// (label: valor formatado), alinhado à direita, separado do conteúdo anterior por uma linha
// superior. Componente interno: não é exportado no barrel `src/pdf.ts`.
import { Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { ReportComputedSummaryItem, ReportStyleConfig } from "../../core/types.js";

export type ReportPdfSummaryProps = {
  items: ReportComputedSummaryItem[];
  style: Required<ReportStyleConfig>;
};

export function ReportPdfSummary({ items, style }: ReportPdfSummaryProps): ReactElement {
  return (
    <View
      style={{
        marginTop: 12,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: style.accentColor,
        alignItems: "flex-end",
      }}
      wrap={false}
    >
      {items.map((item, index) => (
        <View key={index} style={{ flexDirection: "row", marginTop: index === 0 ? 0 : 2 }}>
          <Text style={{ fontSize: style.fontSize, color: "#374151", marginRight: 6 }}>
            {item.label}:
          </Text>
          <Text style={{ fontSize: style.fontSize, fontWeight: "bold" }}>{item.formatted}</Text>
        </View>
      ))}
    </View>
  );
}
