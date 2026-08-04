---
"cosmemilton-report": minor
---

Reforma visual do editor/designer e novo painel de configuração global:

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
