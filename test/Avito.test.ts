import {
  AVITO_COLOR_VALUES,
  Currency,
  Formatters,
  Vat,
  type AvitoFormatterOptions,
  type AvitoProductError,
  type Product,
} from "src";
import { describe, expect, it } from "vitest";

import { streamToBuffer } from "./utils/streamToBuffer";

import { PassThrough } from "stream";

const baseOptions: AvitoFormatterOptions = {
  category: "Одежда, обувь, аксессуары",
  goodsType: "Мужская обувь",
  condition: "Новое с биркой",
  adType: "Товар приобретен на продажу",
  apparelType: "Кроссовки",
};

const validProduct = (overrides?: Partial<Product>): Product => ({
  productId: 1,
  variantId: 11,
  title: "Nike Air Force 1",
  description: "Кроссовки Nike Air Force 1 White, мужские",
  categoryId: 1,
  price: 9990,
  currency: Currency.RUB,
  vat: Vat.VAT_20,
  vendor: "Nike",
  images: ["https://cdn.example.com/img1.jpg"],
  params: [
    { key: "size", value: "42" },
    { key: "color", value: "Белый" },
    { key: "colorname", value: "Молочный белый" },
  ],
  ...overrides,
});

const collectErrors = (): {
  errors: AvitoProductError[];
  onProductError: AvitoFormatterOptions["onProductError"];
} => {
  const errors: AvitoProductError[] = [];
  return {
    errors,
    onProductError: (event): void => {
      errors.push(event);
    },
  };
};

const renderAvito = async (
  products: Product[],
  options: AvitoFormatterOptions,
): Promise<string> => {
  const formatter = new Formatters.AvitoFormatter();
  const stream = new PassThrough();
  await formatter.format(stream, products, undefined, undefined, {
    avito: options,
  });
  return (await streamToBuffer(stream)).toString();
};

describe("AvitoFormatter (strict validator)", () => {
  it("emits valid Avito XML for a fully valid product", async () => {
    const result = await renderAvito([validProduct()], baseOptions);

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(result).toContain("<Ad>");
    expect(result).toContain("<Id>11</Id>");
    expect(result).toContain("<Title>Nike Air Force 1</Title>");
    expect(result).toContain("<Category>Одежда, обувь, аксессуары</Category>");
    expect(result).toContain("<Price>9990</Price>");
    expect(result).toContain(
      '<Image url="https://cdn.example.com/img1.jpg"/>',
    );
    expect(result).toContain("<GoodsType>Мужская обувь</GoodsType>");
    expect(result).toContain("<Condition>Новое с биркой</Condition>");
    expect(result).toContain("<AdType>Товар приобретен на продажу</AdType>");
    expect(result).toContain("<Brand>Nike</Brand>");
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<ColorName>Молочный белый</ColorName>");
    expect(result).toContain("<ApparelType>Кроссовки</ApparelType>");
    expect(result).toContain("<Size>42</Size>");
  });

  it("rejects invalid color enum value via onProductError", async () => {
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      productId: 7,
      params: [
        { key: "size", value: "42" },
        { key: "color", value: "беленький" },
        { key: "colorname", value: "Беленький" },
      ],
    });

    const result = await renderAvito([product], {
      ...baseOptions,
      onProductError,
    });

    expect(result).not.toContain("<Ad>");
    expect(errors).toHaveLength(1);
    expect(errors[0].productId).toBe(7);
    const colorErr = errors[0].errors.find((e) => e.field === "Color");
    expect(colorErr?.reason).toBe("invalid_enum");
    expect(colorErr?.expected).toEqual(AVITO_COLOR_VALUES);
  });

  it("collects all errors per product (missing brand + missing size)", async () => {
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      vendor: undefined,
      params: [
        { key: "color", value: "Белый" },
        { key: "colorname", value: "Белоснежный" },
      ],
    });

    await renderAvito([product], { ...baseOptions, onProductError });

    const reasons = errors[0].errors.map((e) => `${e.field}:${e.reason}`);
    expect(reasons).toEqual(
      expect.arrayContaining(["Brand:missing", "Size:missing"]),
    );
  });

  it("skips invalid products but keeps valid ones in the same call", async () => {
    const { errors, onProductError } = collectErrors();
    const good = validProduct({ productId: 1, variantId: 1 });
    const bad = validProduct({
      productId: 2,
      variantId: 2,
      vendor: undefined,
    });

    const result = await renderAvito([good, bad], {
      ...baseOptions,
      onProductError,
    });

    expect(result).toContain("<Id>1</Id>");
    expect(result).not.toContain("<Id>2</Id>");
    expect(errors.map((e) => e.productId)).toEqual([2]);
  });

  it("throws on the very first invalid product when failOnError=true", async () => {
    const { errors, onProductError } = collectErrors();
    const products = [
      validProduct({ productId: 1, variantId: 1 }),
      validProduct({
        productId: 2,
        variantId: 2,
        vendor: undefined,
      }),
    ];

    await expect(
      renderAvito(products, {
        ...baseOptions,
        failOnError: true,
        onProductError,
      }),
    ).rejects.toThrow(/не прошли валидацию/);
    expect(errors).toHaveLength(1);
  });

  it("throws if AvitoFormatterOptions itself is invalid", async () => {
    await expect(
      renderAvito([validProduct()], {
        ...baseOptions,
        condition: "Новое",
      }),
    ).rejects.toThrow(/condition="Новое"/);
  });

  it("emits TargetAudience only when valid value passed in options", async () => {
    const withAudience = await renderAvito([validProduct()], {
      ...baseOptions,
      targetAudience: "Частные лица",
    });
    expect(withAudience).toContain(
      "<TargetAudience>Частные лица</TargetAudience>",
    );

    const withoutAudience = await renderAvito([validProduct()], baseOptions);
    expect(withoutAudience).not.toContain("<TargetAudience>");

    await expect(
      renderAvito([validProduct()], {
        ...baseOptions,
        targetAudience: "Унисекс",
      }),
    ).rejects.toThrow(/targetAudience="Унисекс"/);
  });

  it("rejects images that are not http(s) URLs", async () => {
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      images: ["image1", "image2"],
    });

    const result = await renderAvito([product], {
      ...baseOptions,
      onProductError,
    });

    expect(result).not.toContain("<Ad>");
    const err = errors[0].errors.find((e) => e.field === "Images");
    expect(err?.reason).toBe("empty_array");
  });

  it("escapes CDATA terminator in Description", async () => {
    const product = validProduct({
      description: "Текст с CDATA-terminator ]]> внутри",
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain(
      "<![CDATA[Текст с CDATA-terminator ]]]]><![CDATA[> внутри]]>",
    );
  });
});
