"use client";

// CmReportPdfPreview — pré-visualização ao vivo do PDF de um relatório, gerada no cliente. Usada
// pelo `CmReportLayoutEditor` (Fase 9) e, futuramente, pelo `CmReportDesigner` (Fase 10).
//
// Decisão de arquitetura (ver plano, "Preview"): NÃO usar `PDFViewer` do react-pdf (flicker/SSR).
// Em vez disso, um efeito debounced gera o PDF via `pdf(doc).toBlob()` (import dinâmico) e exibe
// o resultado num `<iframe src={objectUrl}>`. `@react-pdf/renderer` e `../../pdf.js` (que o
// reexporta) são SEMPRE importados via `import()` dinâmico aqui — nunca de forma estática — para
// que este entry `/client` nunca puxe o peer pesado `@react-pdf/renderer` para o bundle de quem
// não usa o preview.
//
// Debounce: mudanças em `definition`/`rows`/`view`/`globalConfig`/`overrides` (ou `debounceMs`)
// reagendam a geração; mudanças dentro da janela de `debounceMs` cancelam o agendamento anterior,
// então só a última dispara uma geração de fato. As deps do efeito são os próprios objetos de
// entrada — identidade de referência dispara nova geração; é esperado que quem consome este
// componente não recrie `definition`/`rows`/... a cada render sem necessidade.
//
// Token anti-obsoleto: cada geração incrementa um ref antes de começar; quando ela termina
// (sucesso ou erro), só aplica o resultado se o token ainda for o mais recente — senão descarta o
// resultado (revogando o objectURL recém-criado, se houver). Ao desmontar, o token é invalidado e
// o último objectURL exibido é revogado, para nunca aplicar estado a um componente desmontado nem
// vazar memória.
import { useEffect, useRef, useState, type ReactElement } from "react";
// `import type` é sempre apagado na emissão (nunca vira um `import` real em runtime) — usado só
// para extrair o tipo do parâmetro de `pdf(...)` sem violar a regra de nunca importar
// `@react-pdf/renderer` estaticamente neste arquivo (ver `pdf/render.ts`, que faz o mesmo com
// `Parameters<typeof renderToBuffer>[0]` do lado do value import, já que lá é server-side).
import type { pdf as PdfFn } from "@react-pdf/renderer";
import type {
  ReportDefinition,
  ReportGlobalConfig,
  ReportRenderOverrides,
  ReportView,
} from "../../core/types.js";

type ReportPdfDocumentElement = Parameters<typeof PdfFn>[0];

export type CmReportPdfPreviewProps<T> = {
  definition: ReportDefinition<T>;
  rows: T[];
  view?: ReportView | null;
  globalConfig?: Partial<ReportGlobalConfig>;
  overrides?: ReportRenderOverrides;
  /** @default 600 */
  debounceMs?: number;
  className?: string;
  onError?: (error: Error) => void;
};

/** Join simples de classes — este entry não importa utilitários do cosmemilton-ui (o `/client`
 *  deste pacote não deve depender de outro pacote de UI para uma junção de strings). */
function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Pré-visualização ao vivo do PDF de um relatório: gera o PDF no navegador (debounced) a partir
 * de `definition`/`rows`/`view`/`globalConfig`/`overrides` e o exibe num `<iframe>`.
 */
export function CmReportPdfPreview<T>(props: CmReportPdfPreviewProps<T>): ReactElement {
  const {
    definition,
    rows,
    view,
    globalConfig,
    overrides,
    debounceMs = 600,
    className,
    onError,
  } = props;

  const [url, setUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Token da geração em curso (incrementado a cada geração iniciada) — usado para descartar
  // resultados que chegam depois de uma geração mais nova já ter começado.
  const tokenRef = useRef(0);
  // Último objectURL aplicado à tela — revogado ao ser substituído e ao desmontar.
  const urlRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // `onError` passado por ref: evita que uma nova identidade de callback a cada render do
  // consumidor reagende a geração (só as entradas dos dados devem fazer isso).
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    async function generate() {
      const myToken = ++tokenRef.current;
      setIsGenerating(true);
      setErrorMessage(null);

      try {
        const [{ pdf }, { createReportDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("../../pdf.js"),
        ]);

        // Nome `doc` (não `document`) para não sombrear o `document` global do DOM neste arquivo
        // client-side. `createReportDocument` retorna `ReactElement` genérico (contrato público
        // do entry `/pdf`) — convertido para o tipo que `pdf(...)` espera, como em `pdf/render.ts`.
        const doc = createReportDocument({
          definition,
          rows,
          view,
          globalConfig,
          overrides,
        }) as ReportPdfDocumentElement;
        const blob = await pdf(doc).toBlob();
        const nextUrl = URL.createObjectURL(blob);

        if (tokenRef.current !== myToken) {
          // Uma geração mais nova já começou (ou o componente desmontou) enquanto esta estava em
          // andamento — descarta o resultado e libera o objectURL que acabou de ser criado.
          URL.revokeObjectURL(nextUrl);
          return;
        }

        const previousUrl = urlRef.current;
        urlRef.current = nextUrl;
        setUrl(nextUrl);
        setIsGenerating(false);
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
      } catch (err) {
        if (tokenRef.current !== myToken) {
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setIsGenerating(false);
        setErrorMessage("Não foi possível gerar a pré-visualização.");
        onErrorRef.current?.(error);
      }
    }

    timeoutRef.current = setTimeout(generate, debounceMs);
    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [definition, rows, view, globalConfig, overrides, debounceMs]);

  // Cleanup de desmontagem: invalida qualquer geração pendente (o resultado tardio será
  // descartado pela checagem de token acima) e libera o último objectURL exibido.
  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  return (
    <div className={joinClassNames("cm-report-preview", className)}>
      {url ? (
        <iframe
          title="Pré-visualização do relatório"
          src={`${url}#toolbar=0`}
          className="cm-report-preview__frame"
        />
      ) : null}
      {isGenerating ? (
        <div className="cm-report-preview__loading">Gerando pré-visualização…</div>
      ) : null}
      {errorMessage ? <div className="cm-report-preview__error">{errorMessage}</div> : null}
    </div>
  );
}
