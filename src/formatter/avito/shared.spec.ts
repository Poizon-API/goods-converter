import { describe, expect, it } from "vitest";

import { resolveAvitoSize } from "./shared";
import { TEMPLATE_REGISTRY } from "./templates";

const gridOf = (templateId: number): readonly string[] =>
  Object.values(TEMPLATE_REGISTRY).find((s) => s.templateId === templateId)
    ?.sizeValues ?? [];

const SABO = gridOf(100392);
const MEN = gridOf(100368);

describe("resolveAvitoSize", () => {
  it("prerequisite: реальные сетки Avito имеют нужные +бакеты", () => {
    expect(SABO).toContain("44+");
    expect(SABO).not.toContain("44");
    expect(SABO).not.toContain("48+");
    expect(MEN).toContain("48+");
    expect(MEN).not.toContain("44+");
  });

  describe("сабо/мюли (100392, верх 44+)", () => {
    it.each([
      ["44", "44+"],
      ["44,5", "44+"],
      ["45", "44+"],
      ["46", "44+"],
      ["47,5", "44+"],
      ["48+", "44+"],
    ])("размер %s сверх сетки → %s", (raw, expected) => {
      expect(resolveAvitoSize(raw, SABO)).toBe(expected);
    });

    it.each(["36", "42,5", "43,5", "44+"])(
      "валидный размер %s не трогаем",
      (raw) => {
        expect(resolveAvitoSize(raw, SABO)).toBe(raw);
      },
    );

    it("слишком мелкий размер (ниже сетки) не снапаем", () => {
      expect(resolveAvitoSize("20", SABO)).toBe("20");
    });
  });

  describe("мужские кроссовки (100368, верх 48+)", () => {
    it("48+ валиден и остаётся 48+", () => {
      expect(resolveAvitoSize("48+", MEN)).toBe("48+");
    });

    it("индивидуальный 44 валиден и НЕ схлопывается (в отличие от сабо)", () => {
      expect(resolveAvitoSize("44", MEN)).toBe("44");
    });

    it("размер сверх 48 → 48+", () => {
      expect(resolveAvitoSize("49", MEN)).toBe("48+");
    });
  });

  describe("границы", () => {
    it("сетка без +бакета — размер без изменений", () => {
      expect(resolveAvitoSize("45", ["36", "37", "38"])).toBe("45");
    });

    it("пустая сетка — размер без изменений", () => {
      expect(resolveAvitoSize("48+", [])).toBe("48+");
    });

    it("мусорный размер (не парсится) не снапаем", () => {
      expect(resolveAvitoSize("XL", SABO)).toBe("XL");
    });
  });
});
