---
"cosmemilton-report": minor
---

Primeira versão da biblioteca: definição declarativa de relatórios (`defineReport`), config em
camadas (defaults → global → definição → view → overrides), export em PDF (`@react-pdf/renderer`),
CSV/TSV/JSON (zero-dep) e XLSX (`exceljs`), helpers de route handler para Next.js
(`renderReportResponse`), persistência plugável (`ReportStorageAdapter` com adapters de memória e
localStorage), editor visual de layout (`CmReportLayoutEditor`) com preview PDF ao vivo e designer
de relatórios em runtime (`CmReportDesigner`).
