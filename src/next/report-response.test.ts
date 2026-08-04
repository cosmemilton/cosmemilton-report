// @vitest-environment node
// Request/Response nativos do Node 18+ — mesmo racional de src/pdf/render.test.tsx e
// src/xlsx/export-xlsx.test.ts (I/O binário/HTTP não se beneficia do jsdom).
import { describe, expect, it, vi } from "vitest";
import type { ReportColumn, ReportDefinition } from "../core/types.js";
import { reportMimeTypes, reportResponse, renderReportResponse } from "./report-response.js";

type Venda = { data: string; cliente: string; total: number };

const columns: ReportColumn<Venda>[] = [
  { key: "data", header: "Data", format: "date" },
  { key: "cliente", header: "Cliente" },
  { key: "total", header: "Total", format: "currency" },
];

function definition(overrides?: Partial<ReportDefinition<Venda>>): ReportDefinition<Venda> {
  return {
    slug: "vendas",
    name: "Relatório de Vendas",
    columns,
    ...overrides,
  };
}

const rows: Venda[] = [
  { data: "2026-01-15", cliente: "Ana", total: 150.5 },
  { data: "2026-01-20", cliente: "Bruno", total: 200 },
];

describe("reportMimeTypes", () => {
  it("mapeia cada formato para o Content-Type correto", () => {
    expect(reportMimeTypes).toEqual({
      pdf: "application/pdf",
      csv: "text/csv; charset=utf-8",
      tsv: "text/tab-separated-values; charset=utf-8",
      json: "application/json; charset=utf-8",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  });
});

describe("reportResponse", () => {
  it("critério 1: Content-Type e Content-Disposition attachment com a extensão do formato", () => {
    const res = reportResponse({ body: "abc", format: "csv", fileName: "vendas" });

    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain('filename="vendas.csv"');
  });

  it("critério 2: fileName acentuado gera filename* UTF-8 e um filename ASCII saneado", () => {
    const res = reportResponse({ body: "abc", format: "csv", fileName: "relatório-ações" });
    const disposition = res.headers.get("Content-Disposition") ?? "";

    expect(disposition).toContain("filename*=UTF-8''relat%C3%B3rio-a%C3%A7%C3%B5es.csv");
    expect(disposition).toContain('filename="relatorio-acoes.csv"');
  });

  it("critério 3: inline: true troca attachment por inline", () => {
    const res = reportResponse({ body: "abc", format: "pdf", fileName: "vendas", inline: true });
    const disposition = res.headers.get("Content-Disposition") ?? "";

    expect(disposition.startsWith("inline;")).toBe(true);
    expect(disposition).not.toContain("attachment");
  });

  it("Cache-Control default é no-store", () => {
    const res = reportResponse({ body: "abc", format: "json", fileName: "vendas" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("cacheControl customizado sobrepõe o default", () => {
    const res = reportResponse({
      body: "abc",
      format: "json",
      fileName: "vendas",
      cacheControl: "public, max-age=60",
    });
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it("aceita Uint8Array como body", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const res = reportResponse({ body: bytes, format: "xlsx", fileName: "vendas" });
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });
});

describe("renderReportResponse", () => {
  it("critério 4: format csv → corpo começa com BOM UTF-8", async () => {
    const res = await renderReportResponse({ definition: definition(), rows, format: "csv" });
    // `res.text()` NÃO serve para checar o BOM aqui: por spec (WHATWG Encoding Standard),
    // `TextDecoder`/`Response.text()` com as opções default (`ignoreBOM: false`) DESCARTA um BOM
    // inicial ao decodificar — comportamento da plataforma, não deste código (confirmado direto
    // no runtime: `new Response(bytesComBOM).text()` já vem sem o BOM). Por isso a checagem é
    // nos bytes crus via `arrayBuffer()`, onde o BOM (0xEF 0xBB 0xBF) realmente está presente.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });

  it("critério 4: format tsv → texto tabulado sem BOM", async () => {
    const res = await renderReportResponse({ definition: definition(), rows, format: "tsv" });
    const text = await res.text();
    expect(text.startsWith("﻿")).toBe(false);
    expect(text).toContain("\t");
  });

  it("critério 4: format json → JSON.parse funciona", async () => {
    const res = await renderReportResponse({ definition: definition(), rows, format: "json" });
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("critério 4: format pdf → bytes começam com %PDF", async () => {
    const res = await renderReportResponse({ definition: definition(), rows, format: "pdf" });
    const bytes = new Uint8Array(await res.arrayBuffer());
    const signature = Buffer.from(bytes.slice(0, 4)).toString("ascii");
    expect(signature).toBe("%PDF");
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("critério 4: format xlsx → bytes começam com PK (zip)", async () => {
    const res = await renderReportResponse({ definition: definition(), rows, format: "xlsx" });
    const bytes = new Uint8Array(await res.arrayBuffer());
    const signature = Buffer.from(bytes.slice(0, 2)).toString("ascii");
    expect(signature).toBe("PK");
  });

  it("critério 5: fileName default contém o slug e generatedAt em aaaa-mm-dd", async () => {
    const generatedAt = new Date(2026, 7, 4, 10, 30); // 4 de agosto de 2026, 10:30 local
    const res = await renderReportResponse({
      definition: definition(),
      rows,
      format: "pdf",
      generatedAt,
    });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain('filename="vendas-2026-08-04.pdf"');
  });

  it("fileName explícito sobrepõe o default", async () => {
    const res = await renderReportResponse({
      definition: definition(),
      rows,
      format: "csv",
      fileName: "vendas-de-agosto",
    });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain('filename="vendas-de-agosto.csv"');
  });

  it("inline repassado até o header de Content-Disposition", async () => {
    const res = await renderReportResponse({
      definition: definition(),
      rows,
      format: "json",
      inline: true,
    });
    expect((res.headers.get("Content-Disposition") ?? "").startsWith("inline;")).toBe(true);
  });
});

describe("erro de peer opcional ausente (import dinâmico)", () => {
  it("pdf: propaga mensagem pt-BR quando o import de ../pdf.js falha", async () => {
    vi.resetModules();
    vi.doMock("../pdf.js", () => {
      throw new Error("Cannot find package '@react-pdf/renderer'");
    });

    const fresh = await import("./report-response.js");
    await expect(
      fresh.renderReportResponse({ definition: definition(), rows, format: "pdf" }),
    ).rejects.toThrow(/@react-pdf\/renderer/);

    vi.doUnmock("../pdf.js");
    vi.resetModules();
  });

  it("xlsx: propaga mensagem pt-BR quando o import de ../xlsx.js falha", async () => {
    vi.resetModules();
    vi.doMock("../xlsx.js", () => {
      throw new Error("Cannot find package 'exceljs'");
    });

    const fresh = await import("./report-response.js");
    await expect(
      fresh.renderReportResponse({ definition: definition(), rows, format: "xlsx" }),
    ).rejects.toThrow(/exceljs/);

    vi.doUnmock("../xlsx.js");
    vi.resetModules();
  });
});
