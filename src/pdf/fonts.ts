// fonts — registro de famílias de fontes customizadas para o entry /pdf. Wrapper fino sobre
// `Font.register` do react-pdf, que também desativa a hifenização automática: quebrar palavras
// no meio (ex.: números, códigos, e-mails) dentro de células de tabela estreitas prejudica a
// leitura mais do que a palavra simplesmente estourar a largura da célula.
import { Font } from "@react-pdf/renderer";

export type ReportFontSource = {
  src: string;
  fontWeight?: number | "normal" | "bold";
  fontStyle?: "normal" | "italic";
};

export type ReportFontConfig = {
  family: string;
  fonts: ReportFontSource[];
};

/** Registra uma família de fontes (ex.: para usar em `ReportGlobalConfig.fontFamily`) e desativa
 *  a hifenização automática do react-pdf globalmente. Chamar antes de renderizar o PDF (ex.: no
 *  módulo de setup do app, ou no topo do route handler). */
export function registerReportFonts(config: ReportFontConfig): void {
  Font.register({ family: config.family, fonts: config.fonts });
  Font.registerHyphenationCallback((word) => [word]);
}
