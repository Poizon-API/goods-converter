import { collapseAvitoVariantsByParam } from "src/formatter/avito/collapseVariantsByParam";
import { sanitizeAvitoDescription } from "src/formatter/avito/sanitizeDescription";
import { Currency, Vat, type Product } from "src/types";
import { describe, expect, it } from "vitest";

function makeVariant(
  productId: number,
  variantId: string,
  paramKey: string,
  paramValue: string,
  price: number,
  overrides: Partial<Product> = {},
): Product {
  return {
    productId,
    variantId,
    title: `Product ${productId}`,
    description: "Базовое описание товара.",
    categoryId: 8713,
    price,
    currency: Currency.RUB,
    vat: Vat.VAT_20,
    images: ["https://cdn.example.com/img.jpg"],
    vendor: "Nike",
    params: [{ key: paramKey, value: paramValue }],
    ...overrides,
  };
}

describe("collapseAvitoVariantsByParam: базовое поведение", () => {
  it("свёртывает 3 варианта одного productId в 1 продукт с min ценой", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(1, "v2", "Size", "43", 12000),
      makeVariant(1, "v3", "Size", "44", 13500),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe(1);
    expect(result[0].price).toBe(12000);
    expect(result[0].variantId).toBe("v2"); // тот, у кого min price
  });

  it("сохраняет исходное description и добавляет таблицу после separator", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(1, "v2", "Size", "43", 12000),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).toContain("Базовое описание товара.");
    expect(result[0].description).toContain("<br><br>");
    expect(result[0].description).toContain("<p><strong>Варианты и цены:</strong></p>");
    expect(result[0].description).toContain("<li>Size 42 — 15 000 ₽</li>");
    expect(result[0].description).toContain("<li>Size 43 — 12 000 ₽</li>");
  });

  it("одиночную группу не модифицирует (нет смысла в таблице)", () => {
    const product = makeVariant(1, "v1", "Size", "42", 15000);
    const result = collapseAvitoVariantsByParam([product], { paramKey: "Size" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(product);
    expect(result[0].description).toBe("Базовое описание товара.");
  });

  it("несколько productId группируются независимо", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(2, "v1", "Size", "S", 5000),
      makeVariant(1, "v2", "Size", "43", 12000),
      makeVariant(2, "v2", "Size", "M", 4500),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(2);
    const byId = new Map(result.map((p) => [p.productId, p]));
    expect(byId.get(1)?.price).toBe(12000);
    expect(byId.get(2)?.price).toBe(4500);
  });

  it("сохраняет порядок: представитель попадает в позицию первой встречи группы", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(2, "v1", "Size", "S", 5000),
      makeVariant(1, "v2", "Size", "43", 12000),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    // productId=1 первый увиделся в input → представитель productId=1 первым
    // в output, productId=2 — вторым.
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
    "работает с произвольным ключом %s (не привязан к Size)",
    (paramKey, val1, val2) => {
      const products = [
        makeVariant(1, "v1", paramKey, val1, 1000),
        makeVariant(1, "v2", paramKey, val2, 800),
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
      makeVariant(1, "v1", "Color", "Red", 1000),
      makeVariant(1, "v2", "Color", "Blue", 800),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(2); // вся группа осталась
    expect(result.map((p) => p.variantId)).toEqual(["v1", "v2"]);
  });

  it("варианты без paramKey не попадают в таблицу, но группа всё равно сворачивается", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(1, "v2", "Size", "", 12000), // empty value → не попадёт в таблицу
      makeVariant(1, "v3", "Size", "43", 10000),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(10000); // min среди всех
    const description = result[0].description;
    expect(description).toContain("<li>Size 42 — 15 000 ₽</li>");
    expect(description).toContain("<li>Size 43 — 10 000 ₽</li>");
    // У v2 пустое value → строки про него быть не должно
    const liCount = (description.match(/<li>/g) ?? []).length;
    expect(liCount).toBe(2);
  });

  it("игнорирует невалидные цены при выборе min (0, negative, NaN, Infinity)", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 0),
      makeVariant(1, "v2", "Size", "43", -100),
      makeVariant(1, "v3", "Size", "44", NaN),
      makeVariant(1, "v4", "Size", "45", Infinity),
      makeVariant(1, "v5", "Size", "46", 15000),
      makeVariant(1, "v6", "Size", "47", 12000),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(12000);
    expect(result[0].variantId).toBe("v6");
  });

  it("fallback на первый вариант если все цены невалидны (формattер потом отбракует)", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 0),
      makeVariant(1, "v2", "Size", "43", -100),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].variantId).toBe("v1");
  });

  it("читает paramKey из properties, если в params его нет", () => {
    const products = [
      makeVariant(1, "v1", "OtherKey", "x", 15000, {
        params: undefined,
        properties: [{ key: "Size", value: "42" }],
      }),
      makeVariant(1, "v2", "OtherKey", "y", 12000, {
        params: undefined,
        properties: [{ key: "Size", value: "43" }],
      }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
    expect(result[0].description).toContain("Size 42");
    expect(result[0].description).toContain("Size 43");
  });

  it("params имеет приоритет над properties (повтор семантики formatter.buildParamIndex)", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42-from-params", 15000, {
        properties: [{ key: "Size", value: "42-from-properties" }],
      }),
      makeVariant(1, "v2", "Size", "43-from-params", 12000),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).toContain("42-from-params");
    expect(result[0].description).not.toContain("42-from-properties");
  });

  it("empty description: таблица идёт без separator", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000, { description: "" }),
      makeVariant(1, "v2", "Size", "43", 12000, { description: "" }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).not.toMatch(/^<br><br>/);
    expect(result[0].description.startsWith("<p>")).toBe(true);
  });
});

describe("collapseAvitoVariantsByParam: сортировка", () => {
  it("default 'value-numeric-asc' сортирует числовые значения по возрастанию", () => {
    const products = [
      makeVariant(1, "v1", "Size", "44", 12000),
      makeVariant(1, "v2", "Size", "42", 14000),
      makeVariant(1, "v3", "Size", "43", 13000),
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
      makeVariant(1, "v1", "Size", "37", 12000),
      makeVariant(1, "v2", "Size", "36,5", 12000),
      makeVariant(1, "v3", "Size", "36", 12000),
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
      makeVariant(1, "v1", "Size", "M", 12000),
      makeVariant(1, "v2", "Size", "L", 12500),
      makeVariant(1, "v3", "Size", "S", 11500),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;
    // ASC по строке: L < M < S (latin uppercase)
    expect(description.indexOf("Size L")).toBeLessThan(
      description.indexOf("Size M"),
    );
    expect(description.indexOf("Size M")).toBeLessThan(
      description.indexOf("Size S"),
    );
  });

  it("'price-asc' сортирует по цене", () => {
    const products = [
      makeVariant(1, "v1", "Size", "44", 18000),
      makeVariant(1, "v2", "Size", "42", 12000),
      makeVariant(1, "v3", "Size", "43", 15000),
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
});

describe("collapseAvitoVariantsByParam: HTML safety", () => {
  it("HTML-escape'ит специальные символы в value, header, paramKey", () => {
    const products = [
      makeVariant(1, "v1", "<bad>", "a<b>c&d", 12000),
      makeVariant(1, "v2", "<bad>", "x>y", 13000),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "<bad>",
      headerText: "Хедер с <script> и &amp",
    });
    const description = result[0].description;

    // Тело хедера эскейпится:
    expect(description).toContain("&lt;script&gt;");
    expect(description).toContain("&amp;amp"); // & → &amp;
    // paramKey в строке тоже эскейпится:
    expect(description).toContain("&lt;bad&gt;");
    // value:
    expect(description).toContain("a&lt;b&gt;c&amp;d");
    // Не должно быть literal `<bad>` или `<script>` в выходе (вне tag-разметки)
    expect(description).not.toMatch(/<bad>/);
    expect(description).not.toContain("<script>");
  });

  it("производит HTML, который проходит sanitizeAvitoDescription без потерь tag'ов", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 12000),
      makeVariant(1, "v2", "Size", "43", 13000),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });
    const description = result[0].description;

    const sanitized = sanitizeAvitoDescription(description);

    // sanitize не должен схлопнуть нашу таблицу — все наши теги в allowlist'е.
    // (<br> в sanitize становится <br /> — это нормально, но всё ещё там)
    expect(sanitized).toContain("<p><strong>Варианты и цены:</strong></p>");
    expect(sanitized).toContain("<ul>");
    expect(sanitized).toContain("<li>Size 42");
    expect(sanitized).toContain("<li>Size 43");
  });
});

describe("collapseAvitoVariantsByParam: иммутабельность", () => {
  it("не мутирует input products", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(1, "v2", "Size", "43", 12000),
    ];
    const snapshot = JSON.parse(JSON.stringify(products));

    collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(products).toEqual(snapshot);
  });
});

describe("collapseAvitoVariantsByParam: custom форматирование", () => {
  it("headerText/pricePrefix/priceSuffix влияют на output", () => {
    const products = [
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(1, "v2", "Size", "43", 12000),
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
      makeVariant(1, "v1", "Size", "42", 15000),
      makeVariant(1, "v2", "Size", "43", 12000),
    ];

    const result = collapseAvitoVariantsByParam(products, {
      paramKey: "Size",
      separator: "<br>---<br>",
    });
    expect(result[0].description).toContain("Базовое описание товара.<br>---<br><p>");
    expect(result[0].description).not.toContain("Базовое описание товара.<br><br>");
  });
});
