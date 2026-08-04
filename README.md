# cosmemilton-report

Report builder React para Next.js: defina relatórios uma vez, em código, e exporte em **PDF**,
**CSV**, **XLSX**, **JSON** e **TSV** — com editor visual de layout, designer para relatórios
criados pelo usuário em runtime e configuração em camadas (defaults → global → definição → view →
overrides por chamada).

[![npm version](https://img.shields.io/npm/v/cosmemilton-report.svg)](https://www.npmjs.com/package/cosmemilton-report)
[![CI](https://github.com/cosmemilton/cosmemilton-report/actions/workflows/ci.yml/badge.svg)](https://github.com/cosmemilton/cosmemilton-report/actions/workflows/ci.yml)
[![docs](https://img.shields.io/badge/docs-miltonjunior.dev.br-blue)](https://miltonjunior.dev.br/cosmemilton-report)

> 📖 **Documentação completa com exemplos ao vivo:**
> [miltonjunior.dev.br/cosmemilton-report](https://miltonjunior.dev.br/cosmemilton-report) —
> playground com seus próprios dados (JSON/CSV), demos interativas do editor e do designer,
> guias de PDF/planilhas/Next.js e uma API de exemplo gerando relatórios reais.

## Instalação

```bash
npm i cosmemilton-report
```

O core (`cosmemilton-report`) é zero-dependency e roda em qualquer lugar (server e client). Os
demais recursos dependem de peers **opcionais** — instale só o que for usar:

| Peer                                           | Necessário para                                                                                      | Quando instalar                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@react-pdf/renderer` (`^4.3`)                 | entry `/pdf` (`renderReportToBuffer`, `createReportDocument`) e o preview do editor/designer         | Vai gerar ou pré-visualizar PDF                                                                                                                           |
| `exceljs` (`^4.4`)                             | entry `/xlsx` (`exportReportToXlsx`)                                                                 | Vai exportar XLSX                                                                                                                                         |
| `cosmemilton-ui` (`>=3.17`) + `@iconify/react` | entry `/client` (`useReportViews`, `CmReportLayoutEditor`, `CmReportDesigner`, `CmReportPdfPreview`) | Vai usar o editor/designer/preview em telas do seu app — o `CmSelect` do `cosmemilton-ui` usa `@iconify/react` internamente, então instale os dois juntos |
| `next` (`>=15`)                                | nada em runtime                                                                                      | Opcional/semântico: o entry `/next` só usa `Response`/`Headers` (Web API padrão), não importa nada de `next`                                              |

**Uso só-servidor não precisa de nenhuma lib de UI.** Se você só gera CSV/PDF/XLSX dentro de um
route handler (o caminho recomendado — veja [Server ou client?](#server-ou-client)), não instale
`cosmemilton-ui` nem `@iconify/react`: eles só entram quando você usa o entry `/client` (editor,
designer ou preview ao vivo em uma tela).

```bash
# PDF
npm i @react-pdf/renderer
# XLSX
npm i exceljs
# Editor/designer/preview (telas do app)
npm i cosmemilton-ui @iconify/react
```

## Quickstart

**1. Defina o relatório** ([`examples/01-minimo.ts`](./examples/01-minimo.ts)):

```ts
import { defineReport } from "cosmemilton-report";

export type Venda = { data: string; cliente: string; total: number };

export const relatorioVendas = defineReport<Venda>({
  slug: "vendas",
  name: "Relatório de Vendas",
  columns: [
    { key: "data", header: "Data", format: "date", width: "15%" },
    { key: "cliente", header: "Cliente", width: "55%" },
    { key: "total", header: "Total", format: "currency", width: "30%" },
  ],
  summary: [{ label: "Total geral", sourceColumn: "total", operation: "sum", format: "currency" }],
});
```

**2. Sirva num route handler** ([`examples/02-route-handler.ts`](./examples/02-route-handler.ts),
`app/api/relatorios/vendas/route.ts`):

```ts
import { renderReportResponse } from "cosmemilton-report/next";
import { relatorioVendas } from "./relatorio-vendas";

export async function GET(req: Request) {
  const format = (new URL(req.url).searchParams.get("format") ?? "pdf") as "pdf" | "csv" | "xlsx";
  return renderReportResponse({
    definition: relatorioVendas,
    rows: await buscarVendas(),
    format,
    fileName: "relatorio-vendas",
    globalConfig: { companyName: "Minha Empresa" },
  });
}
```

**3. Exporte com um botão** ([`examples/03-hook-export.tsx`](./examples/03-hook-export.tsx)):

```tsx
"use client";
import { useReportExport } from "cosmemilton-report/client";
import { CmButton } from "cosmemilton-ui/client";

export function BotaoExportarVendas() {
  const { exportReport, isExporting } = useReportExport({ endpoint: "/api/relatorios/vendas" });

  return (
    <CmButton
      loading={isExporting}
      onClick={() => exportReport({ format: "pdf", params: { mes: "2026-08" } })}
    >
      Exportar PDF
    </CmButton>
  );
}
```

Prontos para explorar mais: [`examples/04-editor-localstorage.tsx`](./examples/04-editor-localstorage.tsx)
(editor de layout), [`examples/05-avancado-grupos.tsx`](./examples/05-avancado-grupos.tsx)
(agrupamento, `pdfRender` custom, seções) e [`examples/06-designer-runtime.tsx`](./examples/06-designer-runtime.tsx)
(designer + route handler genérico).

## Entries

| Entry                       | Conteúdo                                                                                                                                                         | Peer necessário                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `cosmemilton-report`        | Core headless, server-safe, zero deps: `defineReport`, `resolveReport`, formatters, registry, storage adapters (memória/localStorage), serializers CSV/TSV/JSON  | —                                   |
| `cosmemilton-report/pdf`    | `createReportDocument`, `renderReportToBuffer`, `renderReportToStream`, `registerReportFonts`, reexport de `Text`/`View`/`StyleSheet`/`Image`                    | `@react-pdf/renderer`               |
| `cosmemilton-report/xlsx`   | `exportReportToXlsx`                                                                                                                                             | `exceljs`                           |
| `cosmemilton-report/client` | Hooks (`useReportExport`, `useReportViews`, `useReportDefinitions`) + `CmReportLayoutEditor`, `CmReportPdfPreview`, `CmReportDesigner` (arquivos `"use client"`) | `cosmemilton-ui` + `@iconify/react` |
| `cosmemilton-report/next`   | `reportResponse`, `renderReportResponse` — helpers de route handler (`Response` padrão Web)                                                                      | — (`next` é só semântico)           |

## Server ou client?

**Recomendado: route handler** ([exemplo 02](./examples/02-route-handler.ts)). É o caminho padrão
para Next.js porque:

- Sem limite de payload de server action (PDFs/XLSX grandes não sofrem com o limite de tamanho de
  resposta de server actions).
- Suporta streaming (`renderReportToStream`).
- `@react-pdf/renderer`/`exceljs` ficam de fora do bundle do cliente — só o servidor os carrega
  (e só quando o formato pedido realmente precisa deles: `renderReportResponse` usa `import()`
  dinâmico por formato).
- Fontes customizadas e logo são lidas no servidor, sem expor URLs internas ou credenciais de
  acesso a arquivos ao cliente.

**Use client-side quando:** for um preview ao vivo (editor/designer, via `CmReportPdfPreview`) ou
um export leve que não precisa ida-e-volta ao servidor (CSV/TSV/JSON pequenos, com
`useReportExport` sem `endpoint`).

**Alternativa documentada: server action com base64.** Funciona, mas herda os limites de payload
de server actions — prefira para arquivos pequenos:

```ts
"use server";
import { renderReportToBuffer } from "cosmemilton-report/pdf";
import { relatorioVendas } from "./relatorio-vendas";
import type { Venda } from "./relatorio-vendas";

export async function exportarVendasAction(rows: Venda[]): Promise<string> {
  const buffer = await renderReportToBuffer({ definition: relatorioVendas, rows });
  return Buffer.from(buffer).toString("base64");
}
```

No client, decodifique o base64 de volta para `Blob` e use `downloadBlob` (entry `/client`) para
disparar o download.

## Camadas de configuração

`resolveReport` mescla 5 camadas, da mais genérica para a mais específica — em cada campo,
`undefined` herda o valor da camada anterior; um valor explícito sempre vence:

```
defaults (defaultReportGlobalConfig / defaultReportHeader / defaultReportStyle)
  └─▶ globalConfig   (Partial<ReportGlobalConfig> — empresa, logo, papel, margens...)
        └─▶ definition   (ReportDefinition — header/style/summary declarados no código)
              └─▶ view         (ReportView — overrides serializáveis por coluna, gravados pelo editor)
                    └─▶ overrides    (ReportRenderOverrides — só nesta chamada, ex.: título dinâmico)
```

O merge é **explícito por campo** (sem deep-merge genérico) e por seção (`header`, `style`,
`page`...) — cada seção decide como se funde, mas a regra é sempre a mesma: campo ausente/
`undefined` herda, campo presente sobrescreve. Exemplo:

```ts
import { resolveReport } from "cosmemilton-report";
import { relatorioVendas } from "./relatorio-vendas";

const resolved = resolveReport({
  definition: relatorioVendas,
  globalConfig: { companyName: "Minha Empresa", style: { fontSize: 9 } },
  view, // pode sobrescrever style.fontSize de novo, por coluna/seção
  overrides: { title: "Vendas de Agosto/2026" }, // só nesta chamada, não persiste em lugar nenhum
});
```

## Views (variantes de layout)

Cada relatório de código ganha automaticamente uma **view do sistema** (`id: "system:${slug}"`,
somente leitura, `isDefault` quando o slug ainda não tem default) — provisionada de forma
idempotente por `ensureReportViews`. O usuário pode **duplicar** a view do sistema para criar uma
cópia editável (`isSystem: false`) e marcar qualquer uma como padrão do slug.

`useReportViews({ slug, definition, adapter })` (entry `/client`) provisiona a view do sistema no
mount e expõe `views`, `activeView` (a default), `selectedView` (controlada por `selectView`) e as
mutações `duplicateView`/`saveView`/`deleteView`/`setDefault`. `CmReportLayoutEditor` consome uma
`view` controlada e só emite **overrides serializáveis** por `onViewChange` — nunca modifica a
`ReportDefinition` original. Veja o fluxo completo, com seletor de views e botão de duplicar, em
[`examples/04-editor-localstorage.tsx`](./examples/04-editor-localstorage.tsx).

## Relatórios criados pelo usuário (designer)

Além dos relatórios de código, a v1 permite que o usuário final **crie relatórios novos em
runtime** (estilo FastReport/FortesReport tabular), a partir de fontes de dados que o app registra:

```ts
export type ReportDataSource = {
  id: string;
  name: string;
  description?: string;
  fields: { key: string; label: string; format?: ReportFormat }[];
};
```

`CmReportDesigner` (entry `/client`) recebe essas `dataSources`, um `ReportStorageAdapter` e
monta um construtor de relatório: nome/slug, escolha da fonte, campos → colunas (com as mesmas
abas colunas/cabeçalho/sumário/estilo do editor, mais uma seção de agrupamento), preview ao vivo e
salvar. O resultado é uma `SerializableReportDefinition` — **JSON puro, sem funções** — persistida
via `adapter.saveDefinition`.

Para servir os dois mundos (relatórios de código e os criados no designer) num único route
handler `[slug]`, combine-os com `mergeReportDefinitions` (código sempre vence em caso de slug
repetido) e um `createReportRegistry`:

```tsx
// app/relatorios/designer/page.tsx ("use client")
<CmReportDesigner
  dataSources={[
    {
      id: "vendas",
      name: "Vendas",
      fields: [
        { key: "data", label: "Data", format: "date" },
        { key: "cliente", label: "Cliente" },
        { key: "total", label: "Total", format: "currency" },
      ],
    },
  ]}
  adapter={adapter}
  getPreviewRows={async () => buscarAmostraVendas()}
  onSaved={(def) => router.push(`/relatorios/${def.slug}`)}
/>
```

```ts
// app/api/relatorios/[slug]/route.ts — serve os dois mundos
const defs = mergeReportDefinitions(definicoesDeCodigo, await adapter.listDefinitions());
const registry = createReportRegistry(defs);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const def = registry.get(slug);
  if (!def) return new Response("Relatório não encontrado", { status: 404 });
  const rows = await fetchers[def.dataSource ?? slug](); // mapa do app: fonte → busca
  return renderReportResponse({ definition: def, rows, format: "pdf", fileName: slug });
}
```

Exemplo completo (os dois trechos): [`examples/06-designer-runtime.tsx`](./examples/06-designer-runtime.tsx).

> **Aviso:** definições salvas pelo designer são **só declarativas** — `SerializableReportColumn`
> não tem `exportValue`/`pdfRender`, e `SerializableReportDefinition` não tem `sections`. Colunas
> com renderização PDF customizada ou seções extras exigem uma `ReportDefinition` de código (veja
> [Limitações v1](#limitações-v1)).

## Persistência

A lib não conhece banco de dados — quem integra implementa um `ReportStorageAdapter`:

```ts
export type ReportStorageAdapter = {
  loadGlobalConfig(): Promise<ReportGlobalConfig | null>;
  saveGlobalConfig(config: ReportGlobalConfig): Promise<void>;
  listViews(slug?: string): Promise<ReportView[]>;
  getView(id: string): Promise<ReportView | null>;
  saveView(view: ReportView): Promise<void>; // upsert por id
  deleteView(id: string): Promise<void>; // lança se isSystem
  setDefaultView(slug: string, viewId: string): Promise<void>;
  listDefinitions(): Promise<SerializableReportDefinition[]>;
  getDefinition(slug: string): Promise<SerializableReportDefinition | null>;
  saveDefinition(definition: SerializableReportDefinition): Promise<void>; // upsert por slug
  deleteDefinition(slug: string): Promise<void>; // remove também as views do slug
};
```

`createLocalStorageReportAdapter()` e `createMemoryReportAdapter()` vêm prontos (core, zero
deps). Para persistência real (ex.: Prisma), implemente o adapter contra o seu schema — segue um
esqueleto de referência com duas tabelas (`ReportDefinition`, `ReportView`) mais uma linha
singleton de config, tudo com o payload serializável guardado num campo `Json`:

```prisma
// schema.prisma (sugestão)
model ReportDefinition {
  slug      String   @id
  data      Json // SerializableReportDefinition inteira
  updatedAt DateTime @updatedAt
}

model ReportView {
  id        String   @id
  slug      String
  isSystem  Boolean  @default(false)
  isDefault Boolean  @default(false)
  data      Json // ReportView inteira (name/columns/header/style/summary)
  updatedAt DateTime @updatedAt

  @@index([slug])
}

model ReportGlobalConfig {
  id   Int  @id @default(1) // linha única (singleton)
  data Json
}
```

```ts
// adapters/prisma-report-adapter.ts (esqueleto — adapte ao seu schema/PrismaClient)
// import { PrismaClient } from "@prisma/client";
// import {
//   parseReportDefinition,
//   parseReportGlobalConfig,
//   parseReportView,
//   type ReportStorageAdapter,
// } from "cosmemilton-report";
//
// export function createPrismaReportAdapter(prisma: PrismaClient): ReportStorageAdapter {
//   return {
//     async loadGlobalConfig() {
//       const row = await prisma.reportGlobalConfig.findUnique({ where: { id: 1 } });
//       return row ? parseReportGlobalConfig(row.data) : null;
//     },
//     async saveGlobalConfig(config) {
//       await prisma.reportGlobalConfig.upsert({
//         where: { id: 1 },
//         create: { id: 1, data: config },
//         update: { data: config },
//       });
//     },
//
//     async listViews(slug) {
//       const rows = await prisma.reportView.findMany({ where: slug ? { slug } : undefined });
//       return rows.map((row) => parseReportView(row.data)).filter((v) => v !== null);
//     },
//     async getView(id) {
//       const row = await prisma.reportView.findUnique({ where: { id } });
//       return row ? parseReportView(row.data) : null;
//     },
//     async saveView(view) {
//       await prisma.reportView.upsert({
//         where: { id: view.id },
//         create: {
//           id: view.id,
//           slug: view.slug,
//           isSystem: view.isSystem,
//           isDefault: view.isDefault,
//           data: view,
//         },
//         update: { isDefault: view.isDefault, data: view },
//       });
//     },
//     async deleteView(id) {
//       const row = await prisma.reportView.findUnique({ where: { id } });
//       if (row?.isSystem) throw new Error(`Não é possível excluir a view do sistema "${id}".`);
//       await prisma.reportView.delete({ where: { id } });
//     },
//     async setDefaultView(slug, viewId) {
//       await prisma.$transaction([
//         prisma.reportView.updateMany({ where: { slug }, data: { isDefault: false } }),
//         prisma.reportView.update({ where: { id: viewId }, data: { isDefault: true } }),
//       ]);
//     },
//
//     async listDefinitions() {
//       const rows = await prisma.reportDefinition.findMany();
//       return rows.map((row) => parseReportDefinition(row.data)).filter((d) => d !== null);
//     },
//     async getDefinition(slug) {
//       const row = await prisma.reportDefinition.findUnique({ where: { slug } });
//       return row ? parseReportDefinition(row.data) : null;
//     },
//     async saveDefinition(definition) {
//       await prisma.reportDefinition.upsert({
//         where: { slug: definition.slug },
//         create: { slug: definition.slug, data: definition },
//         update: { data: definition },
//       });
//     },
//     async deleteDefinition(slug) {
//       await prisma.$transaction([
//         prisma.reportView.deleteMany({ where: { slug } }),
//         prisma.reportDefinition.delete({ where: { slug } }),
//       ]);
//     },
//   };
// }
```

Toda leitura de storage passa por parsers defensivos (`parseReportGlobalConfig`,
`parseReportView`, `parseReportDefinition`): campo inválido cai no default (ou é descartado) em
vez de lançar — útil tanto para JSON corrompido em localStorage quanto para dado inconsistente
vindo do banco.

## Fontes no PDF

Por padrão o PDF usa Helvetica (fonte embutida do PDF, sem acentuação latina completa em todo
peso). Para uma fonte própria, registre-a com `registerReportFonts` (entry `/pdf`) **antes** de
renderizar — no módulo de setup do app ou no topo do route handler:

```ts
import { registerReportFonts } from "cosmemilton-report/pdf";

registerReportFonts({
  family: "Inter",
  fonts: [
    { src: "https://meusite.com/fonts/Inter-Regular.ttf" },
    { src: "https://meusite.com/fonts/Inter-Bold.ttf", fontWeight: "bold" },
  ],
});
```

`src` aceita uma URL (como acima) ou um caminho de arquivo local lido pelo servidor — por exemplo,
um `.ttf` publicado em `/public/fonts` do seu app Next.js resolvido com
`path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")`. Depois, aponte
`globalConfig.fontFamily: "Inter"` (ou defina por relatório/view) para usá-la.

## Formatos e formatação

`formatValue` usa `Intl` nativo, pt-BR/BRL por default (`options.locale`/`options.currency`
trocam isso por relatório). `null`/`undefined` sempre viram `""`; `boolean` sempre vira
`"Sim"`/`"Não"`, independente do `format` pedido:

| `format`   | Entrada                        | Saída (pt-BR)      |
| ---------- | ------------------------------ | ------------------ |
| `text`     | `"Ana"`                        | `Ana`              |
| `number`   | `1234.5`                       | `1.234,50`         |
| `integer`  | `1234`                         | `1.234`            |
| `currency` | `1234.5`                       | `R$ 1.234,50`      |
| `percent`  | `0.42`                         | `42,00%`           |
| `date`     | `"2026-08-01"`                 | `01/08/2026`       |
| `datetime` | `new Date(2026, 7, 1, 14, 30)` | `01/08/2026 14:30` |

`date`/`datetime` aceitam `Date`, string ISO (`"aaaa-mm-dd"` é tratada como data **local**, para
não virar o dia por causa de fuso) ou epoch em milissegundos.

**CSV pt-BR por padrão:** `datasetToCsv`/`exportReportToCsv` usam delimitador `;` e incluem BOM
UTF-8 — assim o Excel em português abre o arquivo já separado em colunas, com acentos corretos,
sem passar pelo assistente de importação. Configurável via `CsvOptions`:

```ts
import { exportReportToCsv } from "cosmemilton-report";

const csvInternacional = exportReportToCsv(
  { definition: relatorioVendas, rows },
  { delimiter: ",", includeBom: false, lineBreak: "\n" },
);
```

## Limitações v1

- O cabeçalho da tabela **não se repete** em cada página do PDF (só na primeira).
- Sem drag-and-drop no editor/designer — reordenar colunas usa botões subir/descer.
- Definições salvas pelo designer são **só declarativas**: sem `pdfRender` por coluna nem
  `sections` customizadas (`SerializableReportColumn`/`SerializableReportDefinition` não têm
  campos de função — isso exige uma `ReportDefinition` de código).
- O designer é tabular; sem posicionamento livre/banded (fora do escopo da v1).

## Licença

[ISC](./LICENSE)
