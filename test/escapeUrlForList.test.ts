import { escapeUrlForList } from "src/utils/escapeUrlForList";
import { expect, describe, it } from "vitest";

describe("escapeUrlForList", () => {
  it("оставляет валидный URL без разделителя нетронутым", () => {
    expect(escapeUrlForList("https://cdn.poizon.com/image1.png")).toBe(
      "https://cdn.poizon.com/image1.png",
    );
  });

  it("кодирует запятые во всём URL — и в path, и в query", () => {
    expect(escapeUrlForList("https://cdn.example.com/a,b.png?c=1,2")).toBe(
      "https://cdn.example.com/a%2Cb.png?c=1%2C2",
    );
  });

  it("нормализует пробел в валидном URL через WHATWG URL", () => {
    expect(escapeUrlForList("https://cdn.example.com/i m.png")).toBe(
      "https://cdn.example.com/i%20m.png",
    );
  });

  it("не теряет невалидный/относительный URL", () => {
    expect(escapeUrlForList("image1")).toBe("image1");
  });

  it("экранирует разделитель и в невалидном URL", () => {
    expect(escapeUrlForList("a,b")).toBe("a%2Cb");
  });

  it("параметризуется разделителем: tab → %09", () => {
    expect(escapeUrlForList("a\tb", "\t")).toBe("a%09b");
  });

  it("параметризуется разделителем: pipe → %7C", () => {
    expect(escapeUrlForList("https://x.io/a|b.png", "|")).toBe(
      "https://x.io/a%7Cb.png",
    );
  });

  it("идемпотентна: повторный прогон не меняет результат", () => {
    const once = escapeUrlForList("https://x.io/a,b.png?c=1,2");
    expect(escapeUrlForList(once)).toBe(once);
  });

  it("пустую строку возвращает как есть", () => {
    expect(escapeUrlForList("")).toBe("");
  });
});
