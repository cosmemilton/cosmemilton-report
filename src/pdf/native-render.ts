import type PDFKitDocument from "pdfkit";
import type { PreparedReportPdf } from "./create-document.js";
import { mmToPt } from "./map-columns.js";
import { createNativeReportPlan, type NativeSection } from "./native-plan.js";

type Measurement = { width: number; height: number; singleLine: boolean };
type MeasuredSection = {
  node: NativeSection;
  height: number;
  textHeight: number;
  children: MeasuredSection[];
};
type MeasuredRow = {
  kind: "row" | "aggregate";
  index: number;
  texts: string[];
  cells: Measurement[];
  height: number;
};
const MAX_CACHED_MEASUREMENTS = 4096;

/** Node 20+ only; null selects the existing React path with the same prepared data. */
export async function renderNativeReportToBuffer<T>(
  report: PreparedReportPdf<T>,
): Promise<Uint8Array | null> {
  if (typeof process === "undefined" || Number.parseInt(process.versions.node, 10) < 20)
    return null;
  const plan = createNativeReportPlan(report);
  if (!plan) return null;
  // Keep the server dependency out of browser bundles importing createReportDocument.
  const pdfkitModule = "pdfkit";
  const { default: PDFDocument } = (await import(
    /* webpackIgnore: true */ /* @vite-ignore */ pdfkitModule
  )) as { default: typeof PDFKitDocument };
  const { resolved, dataset, generatedAt } = report;
  const margins = {
    top: mmToPt(resolved.page.marginTopMm),
    bottom: mmToPt(resolved.page.marginBottomMm),
    left: mmToPt(resolved.page.marginLeftMm),
    right: mmToPt(resolved.page.marginRightMm),
  };
  const pageOptions = {
    size: resolved.page.paperSize === "Letter" ? "LETTER" : "A4",
    layout: resolved.page.orientation,
    margins,
  };
  const doc = new PDFDocument({
    ...pageOptions,
    autoFirstPage: false,
    bufferPages: true,
    compress: true,
    info: { Title: resolved.title, CreationDate: generatedAt },
  });
  const chunks: Uint8Array[] = [];
  const result = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => {
      const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(output);
    });
    doc.on("error", reject);
  });
  // A failed preflight destroys the unused document before falling back to React.
  void result.catch(() => {});
  const unsupported = () => {
    doc.destroy();
    return null;
  };

  try {
    doc.addPage(pageOptions);
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const width = pageWidth - margins.left - margins.right;
    const bottom = pageHeight - margins.bottom;
    const padding = { compact: 2, normal: 4, relaxed: 6 }[resolved.style.density];
    const grid = resolved.style.showGridLines;
    const border = grid ? 1 : 0;
    const fontSize = resolved.style.fontSize;
    const accent = resolved.style.accentColor;
    const columns = resolved.visibleColumns.map((column) => ({
      ...column,
      width: (width * (Math.round(column.widthPct * 100) / 100)) / 100,
    }));
    if (width <= 0 || columns.some((column) => column.width <= 2 * padding + border))
      return unsupported();
    const dimensions = new Map<string, Measurement>();

    function font(size: number, bold = false) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    }
    function measure(text: string, textWidth: number, size: number, bold = false): Measurement {
      const key = `${bold}|${size}|${textWidth}|${text}`;
      const cached = dimensions.get(key);
      if (cached) return cached;
      font(size, bold);
      const measuredWidth = doc.widthOfString(text);
      const singleLine = !/[\r\n]/.test(text) && measuredWidth <= textWidth;
      const measured = {
        width: measuredWidth,
        height:
          text === ""
            ? 0
            : singleLine
              ? doc.currentLineHeight(true)
              : doc.heightOfString(text, { width: textWidth }),
        singleLine,
      };
      if (dimensions.size >= MAX_CACHED_MEASUREMENTS)
        dimensions.delete(dimensions.keys().next().value!);
      dimensions.set(key, measured);
      return measured;
    }
    function drawText(
      text: string,
      x: number,
      y: number,
      textWidth: number,
      size: number,
      bold: boolean,
      color: string,
      align: "left" | "center" | "right",
      measured?: Measurement,
    ) {
      if (!text) return;
      const metric = measured ?? measure(text, textWidth, size, bold);
      font(size, bold);
      doc.fillColor(color);
      if (metric.singleLine) {
        const remaining = textWidth - metric.width;
        const offset = align === "right" ? remaining : align === "center" ? remaining / 2 : 0;
        doc.text(text, x + offset, y, { lineBreak: false });
      } else {
        doc.text(text, x, y, { width: textWidth, height: metric.height + 0.5, align });
      }
    }
    const pad = (value: number) => String(value).padStart(2, "0");
    const date = `${pad(generatedAt.getDate())}/${pad(generatedAt.getMonth() + 1)}/${generatedAt.getFullYear()} ${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`;
    const rightHeader: { text: string; color: string; margin: number }[] = [];
    if (
      resolved.header.showCompanyName &&
      resolved.branding.showCompanyName &&
      resolved.branding.companyName
    ) {
      rightHeader.push({ text: resolved.branding.companyName, color: "#374151", margin: 0 });
    }
    if (resolved.header.showGeneratedAt)
      rightHeader.push({ text: `Gerado em ${date}`, color: "#6b7280", margin: 2 });
    if (resolved.header.showUserName && report.userName)
      rightHeader.push({ text: report.userName, color: "#6b7280", margin: 2 });
    const leftWidth = rightHeader.length ? width * 0.65 : width;
    const rightWidth = width - leftWidth;
    const titleHeight = measure(resolved.title, leftWidth, 16, true).height;
    const subtitleHeight = resolved.subtitle
      ? measure(resolved.subtitle, leftWidth, 10).height + 2
      : 0;
    const rightHeight = rightHeader.reduce(
      (height, item) => height + item.margin + measure(item.text, rightWidth, fontSize).height,
      0,
    );
    const headerContentHeight = Math.max(titleHeight + subtitleHeight, rightHeight);
    const headerHeight = headerContentHeight + 8 + 1 + 12;
    const tableHeaderCells = columns.map((column) =>
      measure(
        column.header,
        column.width - padding * 2 - border,
        resolved.style.headerFontSize,
        true,
      ),
    );
    const tableHeaderHeight =
      Math.max(0, ...tableHeaderCells.map((cell) => cell.height)) +
      padding * 2 +
      border +
      (grid ? 0 : 1);
    const emptyTableSpace = bottom - margins.top - headerHeight - tableHeaderHeight;
    if (emptyTableSpace <= 0) return unsupported();

    function measureSection(node: NativeSection): MeasuredSection {
      const children = node.children.map(measureSection);
      const textHeight =
        node.kind === "text"
          ? measure(node.text ?? "", width, node.style.fontSize, node.style.fontWeight === "bold")
              .height
          : 0;
      return {
        node,
        textHeight,
        children,
        height:
          node.style.marginTop +
          node.style.marginBottom +
          node.style.paddingTop +
          node.style.borderTopWidth +
          textHeight +
          children.reduce((height, child) => height + child.height, 0),
      };
    }
    const beforeTable = plan.beforeTable.map(measureSection);
    const afterTable = plan.afterTable.map(measureSection);
    const afterSummary = plan.afterSummary.map(measureSection);
    // Large custom sections/rows stay with React's existing pagination semantics.
    const sectionSpace = bottom - margins.top - headerHeight;
    if (
      [...beforeTable, ...afterTable, ...afterSummary].some(
        (section) => section.height > sectionSpace,
      )
    )
      return unsupported();
    const blocks: MeasuredRow[][] = [];
    for (const block of report.blocks) {
      const entries: MeasuredRow[] = [];
      for (const entry of block.entries) {
        if (entry.kind === "group") return unsupported();
        const texts = columns.map(
          (_, index) =>
            entry.cells[index]?.formatted ??
            (entry.kind === "aggregate" && index === 0 ? entry.label : ""),
        );
        const bold = entry.kind === "aggregate";
        const cells = texts.map((text, index) =>
          measure(text, columns[index].width - padding * 2 - border, fontSize, bold),
        );
        const height =
          Math.max(0, ...cells.map((cell) => cell.height)) + padding * 2 + border + (bold ? 1 : 0);
        if (height > emptyTableSpace) return unsupported();
        entries.push({
          kind: entry.kind,
          index: entry.kind === "row" ? entry.index : 0,
          texts,
          cells,
          height,
        });
      }
      blocks.push(entries);
    }
    const footerSize = Math.max(fontSize - 1, 6);
    const footerWidth = measure(report.footerText ?? "", width, footerSize).width;
    const maxPagesText = `Página ${Math.max(dataset.rows.length + 10, 999)} de ${Math.max(dataset.rows.length + 10, 999)}`;
    const numberWidth = resolved.header.showPageNumbers
      ? measure(maxPagesText, width, footerSize).width
      : 0;
    if (/[\r\n]/.test(report.footerText ?? "") || footerWidth + numberWidth > width)
      return unsupported();
    let y = margins.top;

    function line(at: number, color: string, thickness: number) {
      doc
        .lineWidth(thickness)
        .strokeColor(color)
        .moveTo(margins.left, at)
        .lineTo(pageWidth - margins.right, at)
        .stroke();
    }
    function drawHeader() {
      y = margins.top;
      drawText(resolved.title, margins.left, y, leftWidth, 16, true, accent, "left");
      if (resolved.subtitle)
        drawText(
          resolved.subtitle,
          margins.left,
          y + titleHeight + 2,
          leftWidth,
          10,
          false,
          "#4b5563",
          "left",
        );
      let rightY = y;
      for (const item of rightHeader) {
        rightY += item.margin;
        const measured = measure(item.text, rightWidth, fontSize);
        drawText(
          item.text,
          margins.left + leftWidth,
          rightY,
          rightWidth,
          fontSize,
          false,
          item.color,
          "right",
          measured,
        );
        rightY += measured.height;
      }
      line(y + headerContentHeight + 8 + 0.5, accent, 1);
      y += headerHeight;
    }
    function drawTableHeader() {
      let x = margins.left;
      columns.forEach((column, index) => {
        if (grid)
          doc
            .lineWidth(0.5)
            .strokeColor("#d1d5db")
            .rect(x + 0.25, y + 0.25, column.width - 0.5, tableHeaderHeight - 0.5)
            .stroke();
        drawText(
          column.header,
          x + padding + border / 2,
          y + padding + border / 2,
          column.width - padding * 2 - border,
          resolved.style.headerFontSize,
          true,
          accent,
          column.align,
          tableHeaderCells[index],
        );
        x += column.width;
      });
      if (!grid) line(y + tableHeaderHeight - 0.5, accent, 1);
      y += tableHeaderHeight;
    }
    function newPage(withTable: boolean) {
      doc.addPage(pageOptions);
      drawHeader();
      if (withTable) drawTableHeader();
    }
    function drawSection(section: MeasuredSection) {
      const { node } = section;
      y += node.style.marginTop;
      if (node.style.borderTopWidth)
        line(
          y + node.style.borderTopWidth / 2,
          node.style.borderTopColor,
          node.style.borderTopWidth,
        );
      y += node.style.borderTopWidth + node.style.paddingTop;
      if (node.kind === "text") {
        drawText(
          node.text ?? "",
          margins.left,
          y,
          width,
          node.style.fontSize,
          node.style.fontWeight === "bold",
          node.style.color,
          node.style.textAlign,
        );
        y += section.textHeight;
      }
      for (const child of section.children) drawSection(child);
      y += node.style.marginBottom;
    }
    function drawSections(sections: MeasuredSection[]) {
      for (const section of sections) {
        if (y + section.height > bottom) newPage(false);
        drawSection(section);
      }
    }
    drawHeader();
    drawSections(beforeTable);
    if (y + tableHeaderHeight + (blocks[0]?.[0]?.height ?? 0) > bottom) newPage(false);
    drawTableHeader();
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      if (blockIndex > 0) newPage(true);
      for (const entry of blocks[blockIndex]) {
        if (y + entry.height > bottom) newPage(true);
        const aggregate = entry.kind === "aggregate";
        if (!aggregate && resolved.style.zebraStripes && entry.index % 2 === 1) {
          doc.rect(margins.left, y, width, entry.height).fill("#f5f5f5");
        }
        if (aggregate) line(y + 0.5, accent, 1);
        let x = margins.left;
        columns.forEach((column, index) => {
          const top = y + (aggregate ? 1 : 0);
          if (grid)
            doc
              .lineWidth(0.5)
              .strokeColor("#d1d5db")
              .rect(
                x + 0.25,
                top + 0.25,
                column.width - 0.5,
                entry.height - (aggregate ? 1 : 0) - 0.5,
              )
              .stroke();
          drawText(
            entry.texts[index],
            x + padding + border / 2,
            top + padding + border / 2,
            column.width - padding * 2 - border,
            fontSize,
            aggregate,
            "#000000",
            column.align,
            entry.cells[index],
          );
          x += column.width;
        });
        y += entry.height;
      }
    }
    drawSections(afterTable);
    drawSections(afterSummary);
    const range = doc.bufferedPageRange();
    font(footerSize);
    const footerHeight = doc.currentLineHeight(true);
    const footerY = pageHeight - Math.max(margins.bottom - 16, 8) - footerHeight;
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      line(footerY - 4.25, "#d1d5db", 0.5);
      drawText(
        report.footerText ?? "",
        margins.left,
        footerY,
        width,
        footerSize,
        false,
        "#6b7280",
        "left",
      );
      if (resolved.header.showPageNumbers)
        drawText(
          `Página ${index - range.start + 1} de ${range.count}`,
          margins.left,
          footerY,
          width,
          footerSize,
          false,
          "#6b7280",
          "right",
        );
    }
    doc.end();
    return await result;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
