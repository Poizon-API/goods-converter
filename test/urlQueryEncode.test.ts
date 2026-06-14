import { urlQueryEncode } from "src/utils/urlQueryEncode";
import { expect, describe, it } from "vitest";

describe("urlQueryEncode", () => {
  it("оставляет валидный URL без запятых нетронутым", () => {
    expect(urlQueryEncode("https://cdn.poizon.com/image1.png")).toBe(
      "https://cdn.poizon.com/image1.png",
    );
  });

  it("percent-кодирует запятые в query, чтобы не расколоть список", () => {
    expect(urlQueryEncode("https://cdn.example.com/i.png?sizes=1,2,3")).toBe(
      "https://cdn.example.com/i.png?sizes=1%2C2%2C3",
    );
  });

  it("не теряет невалидный/относительный URL, а возвращает его", () => {
    expect(urlQueryEncode("image1")).toBe("image1");
  });

  it("экранирует запятые и в невалидном URL", () => {
    expect(urlQueryEncode("a,b")).toBe("a%2Cb");
  });

  it("кодирует запятые и в path, не только в query", () => {
    expect(urlQueryEncode("https://cdn.example.com/a,b.png")).toBe(
      "https://cdn.example.com/a%2Cb.png",
    );
  });

  it("пустую строку возвращает как есть", () => {
    expect(urlQueryEncode("")).toBe("");
  });
});
