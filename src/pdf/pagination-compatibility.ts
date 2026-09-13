import { Fragment, isValidElement, type ReactNode } from "react";

type PageScopedProps = {
  children?: ReactNode;
  fixed?: boolean;
  render?: unknown;
  src?: unknown;
  href?: unknown;
  id?: unknown;
  bookmark?: unknown;
};

/**
 * Conteúdo que depende do documento completo não pode ser renderizado isoladamente.
 * Não invoca componentes opacos nem consome iteradores: seus descendentes podem conter
 * fixed, destinos internos ou render dinâmico que só apareceriam durante o render.
 */
export function requiresContinuousPagination(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(requiresContinuousPagination);
  if (!isValidElement<PageScopedProps>(node)) {
    return node !== null && typeof node === "object";
  }
  if (node.type !== Fragment && typeof node.type !== "string") return true;
  const { fixed, render, src, href, id, bookmark, children } = node.props;
  if (fixed || typeof render === "function" || id != null || bookmark != null) return true;
  if ([src, href].some((value) => typeof value === "string" && value.startsWith("#"))) {
    return true;
  }
  return requiresContinuousPagination(children);
}
