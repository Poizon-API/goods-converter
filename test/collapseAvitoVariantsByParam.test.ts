import { collapseAvitoVariantsByParam } from "src/formatter/avito/collapseVariantsByParam";
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

  it("не модифицирует description представителя", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: 12000 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result[0].description).toBe("Базовое описание товара.");
  });

  it("одиночную группу не модифицирует", () => {
    const product = makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 15000 });
    const result = collapseAvitoVariantsByParam([product], { paramKey: "Size" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(product);
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
  ])("работает с произвольным ключом %s", (paramKey, val1, val2) => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey, paramValue: val1, price: 1000 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey, paramValue: val2, price: 800 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey });

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(800);
  });
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

  it("fallback на первый bearer если все цены невалидны", () => {
    const products = [
      makeAvitoVariant({ productId: 1, variantId: "v1", paramKey: "Size", paramValue: "42", price: 0 }),
      makeAvitoVariant({ productId: 1, variantId: "v2", paramKey: "Size", paramValue: "43", price: -100 }),
    ];

    const result = collapseAvitoVariantsByParam(products, { paramKey: "Size" });

    expect(result).toHaveLength(1);
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
    expect(result[0].price).toBe(12000);
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
