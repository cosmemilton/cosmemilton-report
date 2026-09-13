import { Fragment, isValidElement, type ReactNode } from "react";
import type { PreparedReportPdf } from "./create-document.js";

export type NativeSectionStyle = {
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  textAlign: "left" | "center" | "right";
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  borderTopWidth: number;
  borderTopColor: string;
};
export type NativeSection = {
  kind: "view" | "text";
  style: NativeSectionStyle;
  text?: string;
  children: NativeSection[];
};
export type NativeReportPlan<T> = {
  report: PreparedReportPdf<T>;
  beforeTable: NativeSection[];
  afterTable: NativeSection[];
  afterSummary: NativeSection[];
};

const BASE_STYLE: NativeSectionStyle = {
  fontSize: 8,
  fontWeight: "normal",
  color: "#000000",
  textAlign: "left",
  marginTop: 0,
  marginBottom: 0,
  paddingTop: 0,
  borderTopWidth: 0,
  borderTopColor: "#000000",
};
const STYLE_KEYS = new Set(Object.keys(BASE_STYLE));
const NUMBER_STYLES = new Set([
  "fontSize",
  "marginTop",
  "marginBottom",
  "paddingTop",
  "borderTopWidth",
]);
const COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
// Helvetica's WinAnsi repertoire. Unsupported scripts must retain the React/font path.
const WIN_ANSI =
  /^[\n\r\u0020-\u007e\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]*$/;

function flattenStyle(value: unknown): Record<string, unknown> | null {
  if (value == null || value === false) return {};
  if (Array.isArray(value)) {
    const merged: Record<string, unknown> = {};
    for (const part of value) {
      const style = flattenStyle(part);
      if (!style) return null;
      Object.assign(merged, style);
    }
    return merged;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

function sectionStyle(value: unknown, inherited: NativeSectionStyle): NativeSectionStyle | null {
  const input = flattenStyle(value);
  if (!input) return null;
  const output: NativeSectionStyle = {
    ...BASE_STYLE,
    fontSize: inherited.fontSize,
    fontWeight: inherited.fontWeight,
    color: inherited.color,
    textAlign: inherited.textAlign,
  };
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!STYLE_KEYS.has(key)) return null;
    if (NUMBER_STYLES.has(key)) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        (key === "fontSize" && value === 0)
      )
        return null;
    } else if (key === "color" || key === "borderTopColor") {
      if (typeof value !== "string" || !COLOR.test(value)) return null;
    } else if (key === "fontWeight") {
      if (value !== "normal" && value !== "bold") return null;
    } else if (key === "textAlign" && value !== "left" && value !== "center" && value !== "right") {
      return null;
    }
    Object.assign(output, { [key]: value });
  }
  return output;
}

function textChildren(node: ReactNode): string | null {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    return WIN_ANSI.test(text) ? text : null;
  }
  if (!Array.isArray(node)) return null;
  const parts: string[] = [];
  for (const child of node) {
    const part = textChildren(child);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join("");
}

type SectionProps = { children?: ReactNode; style?: unknown; wrap?: boolean };
function sections(node: ReactNode, inherited: NativeSectionStyle): NativeSection[] | null {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) {
    const output: NativeSection[] = [];
    for (const child of node) {
      const result = sections(child, inherited);
      if (!result) return null;
      output.push(...result);
    }
    return output;
  }
  if (!isValidElement<SectionProps>(node)) return null;
  if (node.type === Fragment) {
    if (Object.keys(node.props).some((key) => key !== "children")) return null;
    return sections(node.props.children, inherited);
  }
  if (node.type !== "TEXT" && node.type !== "VIEW") return null;
  if (
    Object.entries(node.props).some(
      ([key, value]) => value !== undefined && !["children", "style", "wrap"].includes(key),
    )
  )
    return null;
  if (node.props.wrap !== undefined && typeof node.props.wrap !== "boolean") return null;
  const style = sectionStyle(node.props.style, inherited);
  if (!style) return null;
  if (node.type === "TEXT") {
    const text = textChildren(node.props.children);
    return text === null ? null : [{ kind: "text", text, style, children: [] }];
  }
  const children = sections(node.props.children, style);
  return children ? [{ kind: "view", style, children }] : null;
}

/** Conservative server-only subset. Unknown content is never flattened or discarded. */
export function createNativeReportPlan<T>(
  report: PreparedReportPdf<T>,
): NativeReportPlan<T> | null {
  const { resolved, dataset } = report;
  if (
    !["A4", "Letter"].includes(resolved.page.paperSize) ||
    resolved.fontFamily ||
    resolved.group ||
    dataset.summary.length > 0 ||
    resolved.visibleColumns.length === 0 ||
    resolved.visibleColumns.some((column) => column.pdfRender) ||
    (resolved.header.showLogo && resolved.branding.showLogo && resolved.branding.logoUrl)
  )
    return null;
  if (
    !COLOR.test(resolved.style.accentColor) ||
    !Number.isFinite(resolved.style.fontSize) ||
    resolved.style.fontSize <= 0 ||
    !Number.isFinite(resolved.style.headerFontSize) ||
    resolved.style.headerFontSize <= 0 ||
    !["compact", "normal", "relaxed"].includes(resolved.style.density) ||
    !["portrait", "landscape"].includes(resolved.page.orientation)
  )
    return null;
  if (
    [
      resolved.page.marginTopMm,
      resolved.page.marginBottomMm,
      resolved.page.marginLeftMm,
      resolved.page.marginRightMm,
    ].some((value) => !Number.isFinite(value) || value < 0)
  )
    return null;
  const text = [
    resolved.title,
    resolved.subtitle ?? "",
    resolved.branding.companyName ?? "",
    report.userName ?? "",
    report.footerText ?? "",
    ...dataset.columns.map((column) => column.header),
  ];
  for (const block of report.blocks) {
    for (const entry of block.entries) {
      if (entry.kind === "group") return null;
      for (const cell of entry.cells) if (cell) text.push(cell.formatted);
    }
  }
  if (text.some((value) => !WIN_ANSI.test(value))) return null;
  const inherited = { ...BASE_STYLE, fontSize: resolved.style.fontSize };
  const beforeTable = sections(report.beforeTable, inherited);
  const afterTable = sections(report.afterTable, inherited);
  const afterSummary = sections(report.afterSummary, inherited);
  return beforeTable && afterTable && afterSummary
    ? { report, beforeTable, afterTable, afterSummary }
    : null;
}
