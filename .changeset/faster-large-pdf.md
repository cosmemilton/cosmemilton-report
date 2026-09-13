---
"cosmemilton-report": minor
---

Adiciona um motor tabular com PDFKit às APIs PDF do servidor, selecionado automaticamente em Node 20+ para listas compatíveis. Reaproveita o dataset, as colunas visíveis e os valores formatados. Recursos personalizados continuam no React PDF, incluindo códigos de barras, fontes próprias, logotipos, agrupamentos e sumários.

Limita o trabalho de paginação em A4/Letter com blocos de até 100 linhas. Quando o motor React é necessário, renderiza os blocos separadamente e combina o PDF, preservando o rodapé e sua fonte com numeração global. Bobinas de 58/80 mm, conteúdo dinâmico e destinos internos mantêm a paginação contínua.

Adiciona `ReportPdfOptions` às APIs PDF: `engine: "auto" | "react-pdf"` controla a escolha do motor no servidor, e `maxRowsPerBlock` ajusta o tamanho do bloco; `false` mantém a paginação contínua anterior. Cada bloco começa em uma nova página e pode deixar espaço livre ao final. `createReportDocument` permanece React; o stream de PDFs compostos fica disponível após a montagem.

Reutiliza formatadores numéricos com cache limitado, mantendo locale, moeda e precisão. Inclui regressões de PDF e um benchmark reproduzível com limite de memória, timeout e conferência de todas as linhas exportadas.
