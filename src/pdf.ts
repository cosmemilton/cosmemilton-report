// Entry /pdf — requer o peer opcional @react-pdf/renderer.
export { createReportDocument } from "./pdf/create-document.js";
export { renderReportToBuffer, renderReportToStream } from "./pdf/render.js";
export type { ReportFontConfig, ReportFontSource } from "./pdf/fonts.js";
export { registerReportFonts } from "./pdf/fonts.js";
export { mmToPt } from "./pdf/map-columns.js";

// Reexport de conveniência: quem escreve `column.pdfRender`/`section.pdfRender` usa esses
// componentes sem precisar depender diretamente de @react-pdf/renderer no seu código.
export { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
