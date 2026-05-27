import { collapseAvitoVariantsByParam } from "src/formatter/avito/collapseVariantsByParam";
import { sanitizeAvitoDescription } from "src/formatter/avito/sanitizeDescription";
import { type Product } from "src/types";
import { describe, expect, it } from "vitest";

import { makeAvitoVariant } from "./utils/makeAvitoVariant";

describe("collapseAvitoVariantsByParam: базовое поведение", () => {
  it("свёртывает 3 варианта одного productId в 1 продукт с min ценой", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "44", price: 13500 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe(1);
    expect(result[0].price).toBe(12000);
    expect(result[0].variantId).toBe("v2");
  });

  it("сохраняет исходное description и добавляет таблицу после separator", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).toContain("Базовое описание товара.");
    expect(result[0].description).toContain("<br><br>");
    expect(result[0].description).toContain("<p><strong>Варианты и цены:</strong></p>");
    expect(result[0].description).toContain("<li>Size 42 — 15 000 ₽</li>");
    expect(result[0].description).toContain("<li>Size 43 — 12 000 ₽</li>");
  });

  it("одиночную группу не модифицирует", () => {
    const product = makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 });
    const result = collapseAvitoVariantsByParam([product], { paramKey: "Size" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(product);
    expect(result[0].description).toBe("Базовое описание товара.");
  });

  it("несколько productId группируются независимо", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 2, variantId: "v1", paramKey: "Size", paramValue: "S", price: 5000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
      makeAvitoVariant({ productId: 2, variantId: "v2", paramKey: "Size", paramValue: "M", price: 4500 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(2);
    const byId = new Map(result.map((p) => [p.productId, p]));
    expect(byId.get(1)?.price).toBe(12000);
    expect(byId.get(2)?.price).toBe(4500);
  });

  it("представитель попадает в позицию первой встречи группы", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 2, variantId: "v1", paramKey: "Size", paramValue: "S", price: 5000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].productId).toBe(1);
    expect(result[1].productId).toBe(2);
  });
});

describe("collapseAvitoVariantsByParam: generic paramKey", () => {
  it.each([
    ["Color", "Чёрный", "Белый"],
    ["Объём", "100 мл", "200 мл"],
    ["Comfortability", "Hard", "Soft"],
  ])(
    "работает с произвольным ключом %s",
    (paramKey, val1, val2) => {
      const products = [
        makeAvitoVariant({ productId: 1, variantId: "v1", paramKey, paramValue: val1, price: 1000 }),
        makeAvitoVariant({ productId: 1, variantId: "v2", paramKey, paramValue: val2, price: 800 }),
      ];

      const result = collapseAvitoVariantsByParam(products, { paramKey });

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(800);
      expect(result[0].description).toContain(`${paramKey} ${val1}`);
      expect(result[0].description).toContain(`${paramKey} ${val2}`);
    },
  );
});

describe("collapseAvitoVariantsByParam: edge cases", () => {
  it("не сворачивает группу, в которой ни у одного варианта нет paramKey", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Color", paramValue: "Red", price: 1000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Color", paramValue: "Blue", price: 800 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.variantId)).toEqual(["v1", "v2"]);
  });

  it("варианты без paramKey не попадают в таблицу, но группа всё равно сворачивается", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "43", price: 10000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(10000);
    const description = result[0].description;
    expect(description).toContain("<li>Size 42 — 15 000 ₽</li>");
    expect(description).toContain("<li>Size 43 — 10 000 ₽</li>");
    const liCount = (description.match(/<li>/g) ?? []).length;
    expect(liCount).toBe(2);
  });

  it("игнорирует невалидные цены при выборе min (0, negative, NaN, Infinity)", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 0 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: -100 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "44", price: NaN }),
      makeAvitoVariant({ productId: 1, variantId: "v4", paramKey: "Size", paramValue: "45", price: Infinity }),
      makeAvitoVariant({ productId: 1, variantId: "v5", paramKey: "Size", paramValue: "46", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v6", paramKey: "Size", paramValue: "47", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(12000);
    expect(result[0].variantId).toBe("v6");
  });

  it("fallback на первый вариант если все цены невалидны", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 0 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: -100 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe("v1");
  });

  it("читает paramKey из properties, если в params его нет", () => {
    const products = [
      makeAvitoVariant({
        productId: 1, variantId: "v1", paramKey: "OtherKey", paramValue: "x", price: 15000,
        overrides: { params: undefined, properties: [{ key: "Size", value: "42" }] },
      }),
      makeAvitoVariant({
        productId: 1, variantId: "v2", paramKey: "OtherKey", paramValue: "y", price: 12000,
        overrides: { params: undefined, properties: [{ key: "Size", value: "43" }] },
      }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].description).toContain("Size 42");
    expect(result[0].description).toContain("Size 43");
  });

  it("params имеет приоритет над properties", () => {
    const products = [
      makeAvitoVariant({
        productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42-from-params", price: 15000,
        overrides: { properties: [{ key: "Size", value: "42-from-properties" }] },
      }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43-from-params", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).toContain("42-from-params");
    expect(result[0].description).not.toContain("42-from-properties");
  });

  it("empty description: таблица идёт без separator", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000, overrides: { description: "" } }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000, overrides: { description: "" } }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).not.toMatch(/^<br><br>/);
    expect(result[0].description.startsWith("<p>")).toBe(true);
  });
});

describe("collapseAvitoVariantsByParam: сортировка", () => {
  it("default 'value-numeric-asc' сортирует числовые значения по возрастанию", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "44", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "42", price: 14000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "43", price: 13000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;
    const i42 = description.indexOf("Size 42");
    const i43 = description.indexOf("Size 43");
    const i44 = description.indexOf("Size 44");
    expect(i42).toBeLessThan(i43);
    expect(i43).toBeLessThan(i44);
  });

  it("обрабатывает значения с запятой как десятичные ('36,5' < '37')", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "37", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "36,5", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "36", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;
    expect(description.indexOf("36 —")).toBeLessThan(
      description.indexOf("36,5 —"),
    );
    expect(description.indexOf("36,5 —")).toBeLessThan(
      description.indexOf("37 —"),
    );
  });

  it("fallback на locale-aware ASC если хоть одно значение не число", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "M", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "L", price: 12500 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "S", price: 11500 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;
    expect(description.indexOf("Size L")).toBeLessThan(
      description.indexOf("Size M"),
    );
    expect(description.indexOf("Size M")).toBeLessThan(
      description.indexOf("Size S"),
    );
  });

  it("'price-asc' сортирует по цене", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "44", price: 18000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "42", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "43", price: 15000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "Size",
      sort: "price-asc",
    });
    const description = result[0].description;
    expect(description.indexOf("12 000")).toBeLessThan(
      description.indexOf("15 000"),
    );
    expect(description.indexOf("15 000")).toBeLessThan(
      description.indexOf("18 000"),
    );
  });

  it("'value-asc' — plain lexical: '10' < '100' < '2'", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "2", price: 1000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "10", price: 1500 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "100", price: 2000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "Size",
      sort: "value-asc",
    });
    const description = result[0].description;
    expect(description.indexOf("Size 10")).toBeLessThan(
      description.indexOf("Size 100"),
    );
    expect(description.indexOf("Size 100")).toBeLessThan(
      description.indexOf("Size 2"),
    );
  });
});

describe("collapseAvitoVariantsByParam: HTML safety", () => {
  it("escape'ит специальные символы в value, header, paramKey", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "<bad>", paramValue: "a<b>c&d", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "<bad>", paramValue: "x>y", price: 13000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "<bad>",
      headerText: "Хедер с <script> и &amp",
    });
    const description = result[0].description;

    expect(description).toContain("&lt;script&gt;");
    expect(description).toContain("&amp;amp");
    expect(description).toContain("&lt;bad&gt;");
    expect(description).toContain("a&lt;b&gt;c&amp;d");
    expect(description).not.toMatch(/<bad>/);
    expect(description).not.toContain("<script>");
  });

  it("escape работает на pricePrefix и priceSuffix", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 1000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 800 }),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "Size",
      pricePrefix: "<b>от </b>",
      priceSuffix: "<i> руб</i>",
    });
    const description = result[0].description;

    expect(description).toContain("&lt;b&gt;от &lt;/b&gt;");
    expect(description).toContain("&lt;i&gt; руб&lt;/i&gt;");
    expect(description).not.toContain("<b>от </b>");
    expect(description).not.toContain("<i> руб</i>");
  });

  it("output проходит sanitizeAvitoDescription без потерь tag'ов", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 13000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const sanitized = sanitizeAvitoDescription(result[0].description);

    expect(sanitized).toContain("<p><strong>Варианты и цены:</strong></p>");
    expect(sanitized).toContain("<ul>");
    expect(sanitized).toContain("<li>Size 42");
    expect(sanitized).toContain("<li>Size 43");
  });
});

describe("collapseAvitoVariantsByParam: семантика min-price", () => {
  it("min-price выбирается ТОЛЬКО среди вариантов с paramKey", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 700 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "", price: 500 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "43", price: 800 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(700);
    expect(result[0].variantId).toBe("v1");
  });

  it("при price-tie побеждает первый встретившийся", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "44", price: 15000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].variantId).toBe("v1");
  });
});

describe("collapseAvitoVariantsByParam: парсинг числовых значений", () => {
  it("принимает точку как decimal separator ('36.5' → 36.5)", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "37", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "36.5", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v3", paramKey: "Size", paramValue: "36", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;
    expect(description.indexOf("36 —")).toBeLessThan(
      description.indexOf("36.5 —"),
    );
    expect(description.indexOf("36.5 —")).toBeLessThan(
      description.indexOf("37 —"),
    );
  });

  it("отвергает гибрид '36abc' → fallback на locale sort", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "36abc", price: 12000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "37", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;
    expect(description.indexOf("36abc")).toBeLessThan(
      description.indexOf("Size 37"),
    );
  });
});

describe("collapseAvitoVariantsByParam: иммутабельность", () => {
  it("не мутирует input products", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
    ];
    const snapshot: Product[] = structuredClone(products);

    collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(products).toEqual(snapshot);
  });
});

describe("collapseAvitoVariantsByParam: custom форматирование", () => {
  it("headerText/pricePrefix/priceSuffix влияют на output", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "Size",
      headerText: "Available sizes:",
      pricePrefix: "from ",
      priceSuffix: " RUB",
    });

    expect(result[0].description).toContain(
      "<p><strong>Available sizes:</strong></p>",
    );
    expect(result[0].description).toContain("from 15 000 RUB");
    expect(result[0].description).toContain("from 12 000 RUB");
  });

  it("custom separator используется вместо default <br><br>", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "Size",
      separator: "<br>---<br>",
    });
    expect(result[0].description).toContain("Базовое описание товара.<br>---<br><p>");
    expect(result[0].description).not.toContain("Базовое описание товара.<br><br>");
  });
});
