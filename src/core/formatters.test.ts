import { describe, expect, it } from "vitest";
import { formatValue } from "./formatters.js";

/** Normaliza NBSP/narrow-NBSP (usados pelo Intl para separar moeda/número) em espaço comum. */
function normalize(value: string): string {
  return value.replace(/[\u00A0\u202F]/g, " ");
}

describe("formatValue", () => {
  it("formata currency em BRL", () => {
    expect(normalize(formatValue(1234.5, "currency"))).toBe("R$ 1.234,50");
  });

  it("formata number com 2 casas por default", () => {
    expect(normalize(formatValue(1234.5, "number"))).toBe("1.234,50");
  });

  it("formata number com decimals configurável", () => {
    expect(normalize(formatValue(1234.5, "number", { decimals: 0 }))).toBe("1.235");
    expect(normalize(formatValue(1234.5678, "number", { decimals: 3 }))).toBe("1.234,568");
  });

  it("formata integer arredondando", () => {
    expect(normalize(formatValue(1234.5, "integer"))).toBe("1.235");
    expect(normalize(formatValue(10, "integer"))).toBe("10");
  });

  it("formata percent com 2 casas", () => {
    expect(normalize(formatValue(0.153, "percent"))).toBe("15,30%");
  });

  it("formata date a partir de string ISO date-only como data local (dd/mm/aaaa)", () => {
    expect(formatValue("2026-08-04", "date")).toBe("04/08/2026");
  });

  it("formata date a partir de Date e de epoch number", () => {
    expect(formatValue(new Date(2026, 7, 4), "date")).toBe("04/08/2026");
    const epoch = new Date(2026, 7, 4, 10, 30).getTime();
    expect(formatValue(epoch, "date")).toBe("04/08/2026");
  });

  it("formata datetime como dd/mm/aaaa hh:mm", () => {
    expect(formatValue(new Date(2026, 7, 4, 9, 5), "datetime")).toBe("04/08/2026 09:05");
  });

  it("valor inválido de data vira string vazia", () => {
    expect(formatValue("não é uma data", "date")).toBe("");
    expect(formatValue("banana", "datetime")).toBe("");
  });

  it("null e undefined viram string vazia em qualquer formato", () => {
    expect(formatValue(null, "text")).toBe("");
    expect(formatValue(undefined, "currency")).toBe("");
    expect(formatValue(null, "date")).toBe("");
  });

  it("boolean vira Sim/Não", () => {
    expect(formatValue(true, "text")).toBe("Sim");
    expect(formatValue(false, "text")).toBe("Não");
  });

  it("format text retorna a representação em string do valor", () => {
    expect(formatValue("olá", "text")).toBe("olá");
    expect(formatValue(42, "text")).toBe("42");
  });

  it("valor não numérico em formato numérico vira string vazia", () => {
    expect(formatValue("abc", "currency")).toBe("");
    expect(formatValue("abc", "number")).toBe("");
  });

  it("mantém locale, moeda e precisão independentes entre relatórios consecutivos", () => {
    for (let index = 0; index < 3; index += 1) {
      expect(normalize(formatValue(1234.567, "number", { locale: "en-US", decimals: 3 }))).toBe(
        "1,234.567",
      );
      expect(normalize(formatValue(1234.567, "number", { locale: "pt-BR", decimals: 2 }))).toBe(
        "1.234,57",
      );
      expect(normalize(formatValue(12.5, "currency", { locale: "en-US", currency: "USD" }))).toBe(
        "$12.50",
      );
      expect(normalize(formatValue(12.5, "currency", { locale: "ja-JP", currency: "JPY" }))).toBe(
        "￥13",
      );
      expect(formatValue(0.125, "percent", { locale: "en-US", decimals: 1 })).toBe("12.5%");
      expect(formatValue(12.5, "integer", { locale: "en-US", decimals: 3 })).toBe("13");
    }
  });

  it("continua validando opções inválidas depois de formatar valores válidos", () => {
    expect(formatValue(1, "number", { decimals: 2 })).toBe("1,00");
    expect(() => formatValue(1, "number", { decimals: -1 })).toThrow(RangeError);
    expect(() => formatValue(1, "currency", { currency: "INVALID" })).toThrow(RangeError);
    expect(() => formatValue(1, "number", { locale: "not_a_locale" })).toThrow(RangeError);
    expect(formatValue(1, "number", { decimals: 2 })).toBe("1,00");
  });
});
