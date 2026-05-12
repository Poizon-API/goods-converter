import { Formatters, Currency, Vat } from "src";
import type { Product } from "src";
import { describe, expect, it } from "vitest";

import { products } from "./constants";
import { streamToBuffer } from "./utils/streamToBuffer";

import { PassThrough } from "stream";

describe("Avito formatter", () => {
  const formatter = new Formatters.AvitoFormatter();

  it("should export Avito XML with correct root and ad structure", async () => {
    const stream = new PassThrough();
    await formatter.format(stream, [products[1]]);

    const resultString = await streamToBuffer(stream);
    const result = resultString.toString();

    expect(result).toMatchSnapshot();
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(result).toContain("<Ad>");
    expect(result).toContain("<Id>1112</Id>");
    expect(result).toContain("<Title>Title</Title>");
    expect(result).toContain("<Description>");
    expect(result).toContain("<![CDATA[Description]]>");
    expect(result).toContain("<Category>Одежда, обувь, аксессуары</Category>");
    expect(result).toContain("<Price>19000</Price>");
    expect(result).toContain("<GoodsType>Мужская обувь</GoodsType>");
    expect(result).toContain("<Condition>Новое</Condition>");
    expect(result).toContain("<AdType>Товар приобретен на продажу</AdType>");
    expect(result).toContain("<Brand>Nike</Brand>");
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<ColorName>white</ColorName>");
    expect(result).toContain("<ApparelType>Кроссовки</ApparelType>");
    expect(result).toContain("<Size>44</Size>");
    expect(result).not.toContain("<yml_catalog");
    expect(result).not.toContain("<shop>");
    expect(result).not.toContain("<offers>");
    expect(result).not.toContain("<offer");
  });

  it("should serialize product images as separate Image tags", async () => {
    const stream = new PassThrough();
    await formatter.format(stream, [products[0]]);

    const resultString = await streamToBuffer(stream);
    const result = resultString.toString();

    expect(result).toContain("<Images>");
    expect(result).toContain(
      '<Image url="https://cdn.poizon.com/image1.png"/>',
    );
    expect(result).toContain(
      '<Image url="https://cdn.poizon.com/image2.png"/>',
    );
    expect(result).toContain("</Images>");
  });

  it("should support Avito defaults overrides", async () => {
    const stream = new PassThrough();
    await formatter.format(stream, [products[1]], undefined, undefined, {
      avito: {
        category: "Другая категория",
        goodsType: "Женская обувь",
        condition: "Б/у",
        adType: "Товар от производителя",
        apparelType: "Кеды",
        defaultBrand: "Другое",
        defaultColor: "Черный",
        defaultColorName: "Черный",
        defaultSize: "38",
        targetAudience: "Женщины",
      },
    });

    const resultString = await streamToBuffer(stream);
    const result = resultString.toString();

    expect(result).toContain("<Category>Другая категория</Category>");
    expect(result).toContain("<GoodsType>Женская обувь</GoodsType>");
    expect(result).toContain("<Condition>Б/у</Condition>");
    expect(result).toContain("<AdType>Товар от производителя</AdType>");
    expect(result).toContain("<ApparelType>Кеды</ApparelType>");
    expect(result).toContain("<TargetAudience>Женщины</TargetAudience>");
  });

  it("should use fallbacks for required Avito fields", async () => {
    const product: Product = {
      productId: 1,
      variantId: 111,
      title: "Sneakers",
      description: "With CDATA terminator ]]> inside",
      categoryId: 1,
      price: 1000,
      currency: Currency.RUB,
      vat: Vat.VAT_20,
    };

    const stream = new PassThrough();
    await formatter.format(stream, [product]);

    const resultString = await streamToBuffer(stream);
    const result = resultString.toString();

    expect(result).toContain("<Brand>Без бренда</Brand>");
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<ColorName>Белый</ColorName>");
    expect(result).toContain("<Size>42</Size>");
    expect(result).toContain(
      "<![CDATA[With CDATA terminator ]]]]><![CDATA[> inside]]>",
    );
  });

  it("normalizes TargetAudience values via aliases", async () => {
    const cases: Array<{ gender: string | undefined; expected: string | null }> = [
      { gender: "unisex", expected: "Унисекс" },
      { gender: "UNISEX", expected: "Унисекс" },
      { gender: "универсальный", expected: "Унисекс" },
      { gender: "мужской", expected: "Мужчины" },
      { gender: "женский", expected: "Женщины" },
      { gender: "unknown-value", expected: null },
      { gender: undefined, expected: null },
    ];

    for (const { gender, expected } of cases) {
      const stream = new PassThrough();
      const product: Product = {
        productId: 1,
        variantId: 1,
        title: "T",
        description: "D",
        categoryId: 1,
        price: 100,
        currency: Currency.RUB,
        vat: Vat.VAT_20,
        gender,
      };

      await formatter.format(stream, [product]);
      const result = (await streamToBuffer(stream)).toString();

      if (expected === null) {
        expect(
          result,
          `gender=${gender ?? "<undefined>"} should not emit TargetAudience`,
        ).not.toContain("<TargetAudience>");
      } else {
        expect(
          result,
          `gender=${gender} should map to ${expected}`,
        ).toContain(`<TargetAudience>${expected}</TargetAudience>`);
      }
    }
  });

  it("should exclude products with price 0", async () => {
    const stream = new PassThrough();
    await formatter.format(stream, [
      {
        productId: 1,
        variantId: 111,
        title: "Free Product",
        description: "Test",
        categoryId: 1,
        price: 0,
        currency: Currency.RUB,
        vat: Vat.VAT_20,
      },
    ]);

    const resultString = await streamToBuffer(stream);
    const result = resultString.toString();

    expect(result).not.toContain("<Ad>");
    expect(result).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(result).toContain("</Ads>");
  });
});
