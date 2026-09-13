# cosmemilton-report

## 0.3.0

### Minor Changes

- Repete os cabeçalhos de coluna nas páginas de continuação da tabela PDF, preservando
  agrupamentos, totais e seções personalizadas sem sobreposição com o cabeçalho do relatório.

  Adiciona papel térmico `58mm` e `80mm` para PDV: bobina contínua com altura automática, largura
  fixa, margens padrão de 3 mm, cabeçalho vertical e rodapé após o conteúdo. Os formatos estão
  disponíveis no editor global, na configuração, nos overrides e na persistência.
  Sumários com rótulos longos passam a quebrar linha dentro da área imprimível do cupom.

  Adapta o editor de layout, designer e editor global aos toasts do `cosmemilton-ui` para
  validação, sucesso e falhas de operações. Esses componentes passam a exigir `CmToastProvider`
  ancestral; exemplos e README mostram a integração. A duplicação aceita callbacks assíncronos
  e mantém o aviso contextual e a ação de duplicar visíveis.

  Acrescenta testes de PDFs reais (texto, coordenadas, paginação e dimensões de bobina), toasts
  com provider real, uploads de logotipo e persistência dos novos formatos.

### Patch Changes

- Corrige a exportação PDF sem endpoint no navegador, usando `pdf(document).toBlob()` em vez da
  API `renderToBuffer`, exclusiva do Node.js.

  CSV e TSV passam a neutralizar fórmulas em textos e cabeçalhos por padrão, inclusive após
  espaços, tabs ou quebras de linha, preservando valores numéricos negativos, BOM e escaping.
  Adiciona `escapeFormulas: false` a `CsvOptions` e `TsvOptions` para integrações que precisam da
  saída literal; o atalho `exportReportToTsv` também recebe as opções.

## 0.2.1

### Patch Changes

- 28ed3f6: Documentação oficial no ar: `homepage` do pacote e README agora apontam para
  https://miltonjunior.dev.br/cosmemilton-report (exemplos ao vivo, playground com dados próprios,
  demos do editor/designer e guias de PDF, planilhas e Next.js).

## 0.2.0

### Minor Changes

- 493beb0: Reforma visual do editor/designer e novo painel de configuração global:

  - **Novo `CmReportGlobalConfigEditor`**: painel de branding e página (logotipo por URL ou upload
    de imagem convertido para data URI, com preview; nome da empresa; papel A4/Carta; orientação;
    margens em mm; texto do rodapé) — a camada `globalConfig` do `resolveReport` finalmente tem UI.
  - Aba **Colunas** (editor e designer): cartão por coluna em dois andares — switch + rótulo + ações
    no topo, largura/alinhamento/formato embaixo — com botões de ícone (subir/descer/remover) e
    estado visual de coluna oculta.
  - Abas **Cabeçalho/Estilo/Agrupamento**: switches em linhas (rótulo à esquerda, switch à direita)
    dentro de lista com bordas; cor de destaque com amostra + código hex.
  - Aba **Sumário**: item em dois andares (rótulo + remover; coluna-fonte/operação/formato) com
    botões de ícone.
  - Campos da fonte de dados do designer: chips compactos com botão "+" e estado "✓ Coluna já
    adicionada".

## 0.1.0

### Minor Changes

- 5d2dea4: Primeira versão da biblioteca: definição declarativa de relatórios (`defineReport`), config em
  camadas (defaults → global → definição → view → overrides), export em PDF (`@react-pdf/renderer`),
  CSV/TSV/JSON (zero-dep) e XLSX (`exceljs`), helpers de route handler para Next.js
  (`renderReportResponse`), persistência plugável (`ReportStorageAdapter` com adapters de memória e
  localStorage), editor visual de layout (`CmReportLayoutEditor`) com preview PDF ao vivo e designer
  de relatórios em runtime (`CmReportDesigner`).
