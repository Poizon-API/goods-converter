import {
  Currency,
  Formatters,
  Vat,
  type AvitoProductError,
  type AvitoSneakersFormatterOptions,
  type Product,
} from "src";
import { SCHEMA as SCHEMA_100368 } from "src/formatter/avito/templates/100368";
import { SCHEMA as SCHEMA_100388 } from "src/formatter/avito/templates/100388";
import { describe, expect, it } from "vitest";

import { streamToBuffer } from "./utils/streamToBuffer";

import { PassThrough } from "stream";

const baseOptions: AvitoSneakersFormatterOptions = {
  templateId: 100368,
  category: "Одежда, обувь, аксессуары",
  goodsType: "Мужская обувь",
  condition: "Новое с биркой",
  adType: "Товар приобретен на продажу",
  apparelType: "Кроссовки",
};

const validProduct = (overrides?: Partial<Product>): Product => ({
  productId: 1,
  variantId: "11",
  title: "Nike Air Force 1",
  description: "Кроссовки Nike Air Force 1 White, мужские",
  categoryId: 1,
  price: 9990,
  currency: Currency.RUB,
  vat: Vat.VAT_20,
  vendor: "Nike",
  images: ["https://cdn.example.com/img1.jpg"],
  params: [
    { key: "Size", value: "42" },
    { key: "Color", value: "Белый" },
    { key: "ColorName", value: "Молочный белый" },
  ],
  ...overrides,
});

const collectErrors = (): {
  errors: AvitoProductError[];
  onProductError: AvitoSneakersFormatterOptions["onProductError"];
} => {
  const errors: AvitoProductError[] = [];
  return {
    errors,
    onProductError: (event): void => {
      errors.push(event);
    },
  };
};

// Test-only: build options object с заведомо некорректным templateId, обходя
// TS-проверку union'а SupportedTemplateId — нужно для теста runtime guard'а в
// AvitoFormatter. Один `as` здесь сознательный, isolated в test-helper.
function unsafeOptions(
  o: Omit<AvitoSneakersFormatterOptions, "templateId"> & { templateId: number },
): AvitoSneakersFormatterOptions {
  return o as AvitoSneakersFormatterOptions;
}

const renderAvito = async (
  products: Product[],
  options: AvitoSneakersFormatterOptions,
): Promise<string> => {
  const formatter = new Formatters.AvitoFormatter();
  const stream = new PassThrough();
  // failOnError=true вызывает stream.destroy(err) — error на PassThrough'е
  // без обработчика валится в uncaughtException и роняет vitest. Поглощаем;
  // ошибка всё равно всплывает через reject от `format(...)`.
  stream.on("error", () => {});
  await formatter.format(stream, products, undefined, undefined, {
    avito: options,
  });
  return (await streamToBuffer(stream)).toString();
};

/**
 * Альтернатива renderAvito для тестов abort-протокола: собирает stream-
 * events (error/finish/destroyed) вместе с накопленным буфером, чтобы тест
 * мог утверждать, что downstream получил именно 'error', а не корректный
 * 'finish'. renderAvito глушит 'error' молча и не позволяет это проверить.
 */
const renderAvitoWithStreamEvents = async (
  products: Product[],
  options: AvitoSneakersFormatterOptions,
): Promise<{
  reject: Error | null;
  errored: Error | null;
  destroyed: boolean;
  buffer: string;
}> => {
  const formatter = new Formatters.AvitoFormatter();
  const stream = new PassThrough();
  // Без обработчика 'error' Node бросит uncaughtException и уронит vitest.
  // Это listener-no-op; реальную проверку делаем через stream.errored ниже.
  stream.on("error", () => {});
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));

  let reject: Error | null = null;
  try {
    await formatter.format(stream, products, undefined, undefined, {
      avito: options,
    });
  } catch (err) {
    reject = err instanceof Error ? err : new Error(String(err));
  }
  if (!stream.closed) {
    await new Promise<void>((resolve) =>
      stream.once("close", () => {
        resolve();
      }),
    );
  }
  // stream.errored (Node 18+) хранит err, переданный в .destroy(err). Это
  // надёжнее 'error' event'а: в pipeline-сценариях с pipe'ами событие
  // может уйти upstream/downstream раньше нашего listener'а, а property
  // выставляется атомарно при destroy().
  return {
    reject,
    errored: stream.errored instanceof Error ? stream.errored : null,
    destroyed: stream.destroyed,
    buffer: Buffer.concat(chunks).toString(),
  };
};

describe("AvitoFormatter (strict validator)", () => {
  it("emits valid Avito XML for a fully valid product", async () => {
    const result = await renderAvito([validProduct()], baseOptions);

    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(result).toContain("<Ad>");
    expect(result).toContain("<Id>1-11</Id>");
    expect(result).toContain("<Title>Nike Air Force 1</Title>");
    expect(result).toContain("<Category>Одежда, обувь, аксессуары</Category>");
    expect(result).toContain("<Price>9990</Price>");
    expect(result).toContain('<Image url="https://cdn.example.com/img1.jpg"/>');
    expect(result).toContain("<GoodsType>Мужская обувь</GoodsType>");
    expect(result).toContain("<Condition>Новое с биркой</Condition>");
    expect(result).toContain("<AdType>Товар приобретен на продажу</AdType>");
    expect(result).toContain("<Brand>Nike</Brand>");
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<ColorName>Молочный белый</ColorName>");
    expect(result).toContain("<ApparelType>Кроссовки</ApparelType>");
    expect(result).toContain("<Size>42</Size>");
  });

  it("rejects Size out of Avito size dictionary as invalid_enum", async () => {
    // Регрессия: GOAT-адаптер отдаёт US-размер (4..14), Avito ждёт EU
    // (36..48+). Без валидации в фид улетал `<Size>10</Size>`, Avito-
    // валидатор отбивал каждое объявление «Неправильно заполнен Размер».
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      params: [
        { key: "Size", value: "10" },
        { key: "Color", value: "Белый" },
        { key: "ColorName", value: "Молочный" },
      ],
    });
    await renderAvito([product], { ...baseOptions, onProductError });
    const sizeErr = errors[0].errors.find((e) => e.field === "Size");
    expect(sizeErr?.reason).toBe("invalid_enum");
    expect(sizeErr?.expected).toEqual(SCHEMA_100368.sizeValues);
  });

  it("normalizes Size '42.5' -> '42,5' before validation and in <Size>", async () => {
    // Avito пишет десятичный разделитель как запятую (`42,5`), GOAT/POIZON
    // обычно отдают точку. Нормализация — единая точка истины в formatter.
    const result = await renderAvito(
      [
        validProduct({
          params: [
            { key: "Size", value: "42.5" },
            { key: "Color", value: "Белый" },
            { key: "ColorName", value: "Молочный" },
          ],
        }),
      ],
      baseOptions,
    );
    expect(result).toContain("<Size>42,5</Size>");
    expect(result).not.toContain("<Size>42.5</Size>");
  });

  it("rejects invalid color enum value via onProductError", async () => {
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      productId: 7,
      params: [
        { key: "Size", value: "42" },
        { key: "Color", value: "беленький" },
        { key: "ColorName", value: "Беленький" },
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
    expect(colorErr?.expected).toEqual(SCHEMA_100368.colorValues);
  });

  it("collects all errors per product (missing brand + missing size)", async () => {
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      vendor: undefined,
      params: [
        { key: "Color", value: "Белый" },
        { key: "ColorName", value: "Белоснежный" },
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
    const good = validProduct({ productId: 1, variantId: "1" });
    const bad = validProduct({
      productId: 2,
      variantId: "2",
      vendor: undefined,
    });

    const result = await renderAvito([good, bad], {
      ...baseOptions,
      onProductError,
    });

    expect(result).toContain("<Id>1-1</Id>");
    expect(result).not.toContain("<Id>2-2</Id>");
    // Точный assert «ровно один <Ad>» — count-substring сильнее, чем «не
    // contain Id>2», который случайно совпадает с productId/variantId
    // (легко сломать сменой фикстуры).
    expect(result.match(/<Ad>/g)?.length ?? 0).toBe(1);
    expect(errors.map((e) => e.productId)).toEqual([2]);
  });

  it("throws on the very first invalid product when failOnError=true", async () => {
    const { errors, onProductError } = collectErrors();
    const products = [
      validProduct({ productId: 1, variantId: "1" }),
      validProduct({
        productId: 2,
        variantId: "2",
        vendor: undefined,
      }),
    ];

    await expect(
      renderAvito(products, {
        ...baseOptions,
        failOnError: true,
        onProductError,
      }),
    ).rejects.toThrow(/failOnError=true/);
    expect(errors).toHaveLength(1);
    expect(errors[0].productId).toBe(2);
  });

  it("failOnError=true aborts downstream stream (destroy + error event)", async () => {
    // Контракт abort-протокола: consumer (S3/fs.WriteStream) должен увидеть
    // именно 'error', а не корректный 'finish' с partial-feed'ом. Без этого
    // assert'а регрессия «забыли writableStream.destroy(err)» прошла бы
    // зелёной — promise всё равно reject'нется, но downstream закроется как
    // успешный upload. См. Avito.formatter.ts:121-123.
    const products = [
      validProduct({ productId: 1, variantId: "1" }),
      validProduct({ productId: 2, variantId: "2", vendor: undefined }),
    ];

    const result = await renderAvitoWithStreamEvents(products, {
      ...baseOptions,
      failOnError: true,
    });

    expect(result.reject).toBeInstanceOf(Error);
    expect(result.reject?.message).toMatch(/failOnError=true/);
    expect(result.errored).toBeInstanceOf(Error);
    expect(result.errored?.message).toMatch(/failOnError=true/);
    expect(result.destroyed).toBe(true);
    // Closing </Ads> не должен попасть в downstream при abort'е — это и есть
    // partial-feed, который abort-протокол как раз обязан предотвратить
    // (consumer не должен принять обрезанный feed за валидный).
    expect(result.buffer).not.toContain("</Ads>");
  });

  it("throws if AvitoSneakersFormatterOptions itself is invalid", async () => {
    await expect(
      renderAvito([validProduct()], {
        ...baseOptions,
        condition: "Новое",
      }),
    ).rejects.toThrow(/condition="Новое"/);
  });

  it("throws when templateId is not in TEMPLATE_REGISTRY", async () => {
    await expect(
      renderAvito(
        [validProduct()],
        unsafeOptions({ ...baseOptions, templateId: 99999 }),
      ),
    ).rejects.toThrow(/templateId=99999 не поддерживается/);
  });

  it("rejects adType with regular space instead of NBSP", async () => {
    // schema.adTypeValues содержат NBSP (U+00A0) между «на» и «продажу»;
    // обычный пробел (U+0020) должен фейлить enum-валидацию — это main
    // foot-gun при ручной правке template'а через find&replace в IDE. Пробел
    // задаём через ` `-escape, чтобы find&replace не «починил» обе
    // стороны разом, превратив регресс-тест в зелёный no-op.
    const adTypeRegularSpace = "Товар приобретен на\u0020продажу";
    await expect(
      renderAvito([validProduct()], {
        ...baseOptions,
        adType: adTypeRegularSpace,
      }),
    ).rejects.toThrow(/adType=/);
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

  it("rejects images when all URLs are not http(s)", async () => {
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
    expect(err?.reason).toBe("invalid_url");
  });

  it("distinguishes Images reasons: missing / empty_array / invalid_url", async () => {
    const undefinedImages = collectErrors();
    await renderAvito([validProduct({ images: undefined })], {
      ...baseOptions,
      onProductError: undefinedImages.onProductError,
    });
    expect(
      undefinedImages.errors[0].errors.find((e) => e.field === "Images")
        ?.reason,
    ).toBe("missing");

    const emptyArray = collectErrors();
    await renderAvito([validProduct({ images: [] })], {
      ...baseOptions,
      onProductError: emptyArray.onProductError,
    });
    expect(
      emptyArray.errors[0].errors.find((e) => e.field === "Images")?.reason,
    ).toBe("empty_array");

    const invalidUrl = collectErrors();
    await renderAvito(
      [validProduct({ images: ["javascript:alert(1)", "https:image1"] })],
      { ...baseOptions, onProductError: invalidUrl.onProductError },
    );
    expect(
      invalidUrl.errors[0].errors.find((e) => e.field === "Images")?.reason,
    ).toBe("invalid_url");
  });

  it("keeps valid http(s) images and silently drops the rest", async () => {
    const { errors, onProductError } = collectErrors();
    const product = validProduct({
      images: [
        "https://cdn.example.com/valid.jpg",
        "javascript:alert(1)",
        "image1",
        "",
      ],
    });

    const result = await renderAvito([product], {
      ...baseOptions,
      onProductError,
    });

    expect(result).toContain(
      '<Image url="https://cdn.example.com/valid.jpg"/>',
    );
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain('url="image1"');
    expect(errors).toHaveLength(0);
  });

  it("deduplicates exact-match image urls (regression: Avito reports «одинаковые фото»)", async () => {
    const url = "https://cdn.example.com/dup.jpg";
    const product = validProduct({
      images: [url, url, url, "https://cdn.example.com/u.jpg"],
    });
    const result = await renderAvito([product], baseOptions);
    const matches = result.match(/<Image url="[^"]+"/g) ?? [];
    expect(matches).toEqual([
      `<Image url="${url}"`,
      `<Image url="https://cdn.example.com/u.jpg"`,
    ]);
  });

  it("treats whitespace-padded image url as duplicate of the trimmed one", async () => {
    const url = "https://cdn.example.com/dup.jpg";
    const product = validProduct({
      images: [url, "  " + url + "  "],
    });
    const result = await renderAvito([product], baseOptions);
    const matches = result.match(/<Image url="[^"]+"/g) ?? [];
    expect(matches).toEqual([`<Image url="${url}"`]);
  });

  it("prevents premature CDATA close on `]]>` in Description", async () => {
    const product = validProduct({
      description: "Текст с CDATA-terminator ]]> внутри",
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain(
      "<![CDATA[Текст с CDATA-terminator ]]&gt; внутри]]>",
    );
  });

  it("prevents premature CDATA close on multiple `]]>` terminators", async () => {
    const product = validProduct({
      description: "A ]]> B ]]> C ]]> D",
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain("<![CDATA[A ]]&gt; B ]]&gt; C ]]&gt; D]]>");
  });

  it("throws when category option is empty", async () => {
    await expect(
      renderAvito([validProduct()], { ...baseOptions, category: "" }),
    ).rejects.toThrow(/category/);
  });

  it("reports Title and Description as missing when empty", async () => {
    const { errors, onProductError } = collectErrors();
    await renderAvito([validProduct({ title: "", description: "" })], {
      ...baseOptions,
      onProductError,
    });
    const reasons = errors[0].errors.map(
      (e) => `${String(e.field)}:${e.reason}`,
    );
    expect(reasons).toEqual(
      expect.arrayContaining(["Title:missing", "Description:missing"]),
    );
  });

  it("reports too_long for Title and Brand above max", async () => {
    const { errors, onProductError } = collectErrors();
    await renderAvito(
      [validProduct({ title: "a".repeat(51), vendor: "b".repeat(51) })],
      { ...baseOptions, onProductError },
    );
    const titleErr = errors[0].errors.find((e) => e.field === "Title");
    expect(titleErr?.reason).toBe("too_long");
    expect(titleErr?.expected).toEqual({ min: 1, max: 50 });
    const brandErr = errors[0].errors.find((e) => e.field === "Brand");
    expect(brandErr?.reason).toBe("too_long");
  });

  it("reports Price out_of_range for zero, negative and above-max", async () => {
    for (const price of [0, -1, 100_000_001]) {
      const { errors, onProductError } = collectErrors();
      await renderAvito([validProduct({ price })], {
        ...baseOptions,
        onProductError,
      });
      const err = errors[0].errors.find((e) => e.field === "Price");
      expect(err?.reason).toBe("out_of_range");
      expect(err?.expected).toEqual({ min: 1, max: 100_000_000 });
    }
  });

  it("reports Price out_of_range for NaN and ±Infinity", async () => {
    // NaN/±Infinity проходят `typeof === 'number'` и обе comparison'ы
    // возвращают false по IEEE-754, поэтому без Number.isFinite-guard'а
    // невалидная цена утекает в <Price>NaN</Price> без сигнала об ошибке.
    // Avito отвергнет такой фид только на upload-стороне.
    for (const price of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const { errors, onProductError } = collectErrors();
      const result = await renderAvito([validProduct({ price })], {
        ...baseOptions,
        onProductError,
      });
      const err = errors[0]?.errors.find((e) => e.field === "Price");
      expect(err?.reason).toBe("out_of_range");
      expect(result).not.toContain("<Ad>");
    }
  });

  it("reports too_long for Description above max", async () => {
    const { errors, onProductError } = collectErrors();
    await renderAvito(
      [
        validProduct({
          description: "a".repeat(SCHEMA_100368.textLimits.Description.max + 1),
        }),
      ],
      { ...baseOptions, onProductError },
    );
    const err = errors[0].errors.find((e) => e.field === "Description");
    expect(err?.reason).toBe("too_long");
    expect(err?.expected).toEqual(SCHEMA_100368.textLimits.Description);
  });

  it("titleOverflowPolicy=truncate режет по word-boundary (не посередине слова) и пускает товар в фид", async () => {
    const { errors, onProductError } = collectErrors();
    const title = "Кроссовки Nike Air Max 90 Triple Black Premium 2024 XX";
    const result = await renderAvito([validProduct({ title })], {
      ...baseOptions,
      titleOverflowPolicy: "truncate",
      onProductError,
    });
    expect(errors).toHaveLength(0);
    const written = result.match(/<Title>(.*)<\/Title>/)?.[1] ?? "";
    expect(written.length).toBeLessThanOrEqual(50);
    expect(written.endsWith(" ")).toBe(false);
    expect(written).not.toMatch(/Prem$|Premi$|Premiu$/);
  });

  it.each([
    [50, false],
    [51, true],
  ])(
    "titleOverflowPolicy=truncate: boundary length=%i → truncated=%s",
    async (len, truncated) => {
      const { errors, onProductError } = collectErrors();
      const result = await renderAvito(
        [validProduct({ title: "a".repeat(len) })],
        { ...baseOptions, titleOverflowPolicy: "truncate", onProductError },
      );
      expect(errors).toHaveLength(0);
      const written = result.match(/<Title>(.*)<\/Title>/)?.[1] ?? "";
      expect(written.length).toBe(truncated ? 50 : len);
    },
  );

  it("titleOverflowPolicy=truncate fallback (первое слово > max) обрезает грубо, без потери товара", async () => {
    const { errors, onProductError } = collectErrors();
    const result = await renderAvito(
      [validProduct({ title: "x".repeat(80) })],
      { ...baseOptions, titleOverflowPolicy: "truncate", onProductError },
    );
    expect(errors).toHaveLength(0);
    expect(result).toContain(`<Title>${"x".repeat(50)}</Title>`);
  });

  it("titleOverflowPolicy=truncate: emoji (surrogate pair) не разрезается посередине", async () => {
    // 💚 = U+1F49A, в UTF-16 surrogate pair (2 code units), 1 code point.
    // value.slice(0, 50) на код-юнитах оставил бы lone surrogate → invalid
    // XML → Avito реджектит фид. Code-point-aware truncate не должен.
    const { errors, onProductError } = collectErrors();
    // 49 ASCII + 1 emoji = 50 code points = 51 UTF-16 code units. Слов нет
    // (без пробелов) → попадаем в fallback-ветку sliced.trim().
    const title = "x".repeat(49) + "💚";
    const result = await renderAvito([validProduct({ title })], {
      ...baseOptions,
      titleOverflowPolicy: "truncate",
      onProductError,
    });
    expect(errors).toHaveLength(0);
    const written = result.match(/<Title>(.*)<\/Title>/)?.[1] ?? "";
    // Никаких lone surrogates: каждый surrogate валиден только в паре.
    expect(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
        written,
      ),
    ).toBe(false);
  });

  it("titleOverflowPolicy=fail кидает throw синхронно (failOnError=false → всё равно throw)", async () => {
    await expect(
      renderAvito([validProduct({ title: "a".repeat(60) })], {
        ...baseOptions,
        failOnError: false,
        titleOverflowPolicy: "fail",
      }),
    ).rejects.toThrow(/Title length=60 > max=50 \(policy="fail"\)/);
  });

  it("titleOverflowPolicy=fail throw НЕ включает preview пользовательского value (PII-safety)", async () => {
    // CWE-209/532: длинные текстовые поля могут содержать PII (телефоны,
    // адреса). Сообщение об ошибке уходит в Sentry/логи — не тащим туда raw.
    const sensitive = "+7-905-123-45-67 paid card 4111111111111111 ".repeat(3);
    await expect(
      renderAvito([validProduct({ title: sensitive })], {
        ...baseOptions,
        titleOverflowPolicy: "fail",
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("+7-"),
      }),
    );
  });

  it.each([undefined, "skip" as const])(
    "titleOverflowPolicy=%s сохраняет старое поведение: товар выпадает с too_long",
    async (policy) => {
      const { errors, onProductError } = collectErrors();
      const opts: AvitoSneakersFormatterOptions = {
        ...baseOptions,
        onProductError,
        titleOverflowPolicy: policy,
      };
      const result = await renderAvito(
        [validProduct({ title: "a".repeat(60) })],
        opts,
      );
      expect(errors[0]?.errors.find((e) => e.field === "Title")?.reason).toBe(
        "too_long",
      );
      expect(result).not.toContain("<Ad>");
    },
  );

  it("descriptionOverflowPolicy=truncate режет описание до max'а с word-boundary", async () => {
    const { errors, onProductError } = collectErrors();
    const limit = SCHEMA_100368.textLimits.Description.max;
    // Заведомо длиннее лимита (на ~50 слов), состоит из «слов»: проверяем
    // что обрезка прошла на пробеле, а не разрезала слово.
    const description = "слово ".repeat(Math.ceil(limit / 6) + 50);
    expect(description.length).toBeGreaterThan(limit);
    const result = await renderAvito([validProduct({ description })], {
      ...baseOptions,
      descriptionOverflowPolicy: "truncate",
      onProductError,
    });
    expect(errors).toHaveLength(0);
    const written = result.match(/<!\[CDATA\[([\s\S]*?)]]>/)?.[1] ?? "";
    expect(written.length).toBeGreaterThan(0);
    expect(written.length).toBeLessThanOrEqual(limit);
    expect(written.endsWith(" ")).toBe(false);
    expect(written).toMatch(/слово$/);
  });

  it("descriptionOverflowPolicy=fail кидает throw для длинного description", async () => {
    const limit = SCHEMA_100368.textLimits.Description.max;
    await expect(
      renderAvito([validProduct({ description: "x".repeat(limit + 1) })], {
        ...baseOptions,
        descriptionOverflowPolicy: "fail",
      }),
    ).rejects.toThrow(/Description length=\d+ > max=\d+/);
  });

  it("descriptionOverflowPolicy=truncate не оставляет оборванный тег в CDATA", async () => {
    // Regress: до clampPartialHtml truncate'al sanitized HTML посередине
    // тега (`<li>it`), на Avito-стороне HTML5-parser ignored по eof-in-tag,
    // ломая разметку.
    const limit = SCHEMA_100368.textLimits.Description.max;
    const items = Math.ceil(limit / 16) + 100;
    const description =
      "<ul>" +
      Array.from({ length: items }, (_, i) => `<li>item${i}</li>`).join("") +
      "</ul>";
    expect(description.length).toBeGreaterThan(limit);
    const result = await renderAvito([validProduct({ description })], {
      ...baseOptions,
      descriptionOverflowPolicy: "truncate",
    });
    const written = result.match(/<!\[CDATA\[([\s\S]*?)]]>/)?.[1] ?? "";
    expect(written.length).toBeGreaterThan(0);
    expect(written.length).toBeLessThanOrEqual(limit);
    // Оборванный start/end-tag (<li, </li, <p) не должен остаться:
    expect(written).not.toMatch(/<\/?[a-zA-Z][^<>]*$/);
  });

  it("descriptionOverflowPolicy=truncate не оставляет оборванный entity в CDATA", async () => {
    // Regress: sanitize-html эскейпит `&` в `&amp;` (+4 chars), и slice
    // мог разрезать ровно посреди → `AAA&am` без `;`. На Avito-стороне
    // HTML5-parser рендерит `&am` литерально вместо `&`.
    const limit = SCHEMA_100368.textLimits.Description.max;
    const segment = "AAAAA&";
    const repeats = Math.ceil(limit / segment.length) + 50;
    const description = "X".repeat(2) + segment.repeat(repeats);
    expect(description.length).toBeGreaterThan(limit);
    const result = await renderAvito([validProduct({ description })], {
      ...baseOptions,
      descriptionOverflowPolicy: "truncate",
    });
    const written = result.match(/<!\[CDATA\[([\s\S]*?)]]>/)?.[1] ?? "";
    expect(written.length).toBeGreaterThan(0);
    expect(written.length).toBeLessThanOrEqual(limit);
    // Оборванный entity (`&am`, `&amp` без `;`) не должен остаться:
    expect(written).not.toMatch(
      /&(?:#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*)$/,
    );
  });

  it("whitespace-only description трактуется как missing — иначе Avito реджектит ad на upload-стороне", async () => {
    const { errors, onProductError } = collectErrors();
    const result = await renderAvito([validProduct({ description: "   " })], {
      ...baseOptions,
      onProductError,
    });
    expect(
      errors[0]?.errors.find((e) => e.field === "Description")?.reason,
    ).toBe("missing");
    expect(result).not.toContain("<Ad>");
  });

  it("reports Id as missing for empty or disallowed-char variantId", async () => {
    // Avito-доку: цифры, английские/русские (кроме ё) буквы, символы
    // `, \ / ( ) [ ] - =`. Подчёркивание `_`, пробел, ё/Ё запрещены.
    for (const variantId of ["", "abc_123", "v 1", "ёлка"]) {
      const { errors, onProductError } = collectErrors();
      await renderAvito([validProduct({ variantId })], {
        ...baseOptions,
        onProductError,
      });
      const err = errors[0].errors.find((e) => e.field === "Id");
      expect(err?.reason).toBe("missing");
    }
  });

  it("reports Id as too_long when composite exceeds 100 chars", async () => {
    const { errors, onProductError } = collectErrors();
    // productId=1 (1 знак), `-` (1 знак), variantId 99 знаков → итого 101.
    await renderAvito(
      [validProduct({ productId: 1, variantId: "x".repeat(99) })],
      { ...baseOptions, onProductError },
    );
    const err = errors[0].errors.find((e) => e.field === "Id");
    expect(err?.reason).toBe("too_long");
  });

  it("accepts composite of exactly 100 chars (boundary)", async () => {
    const { errors, onProductError } = collectErrors();
    // productId=1, `-`, variantId 98 знаков → итого 100. Должно пройти.
    const result = await renderAvito(
      [validProduct({ productId: 1, variantId: "x".repeat(98) })],
      { ...baseOptions, onProductError },
    );
    expect(errors).toEqual([]);
    expect(result).toContain(`<Id>1-${"x".repeat(98)}</Id>`);
  });

  it.each(["абв", "size(M)", "a,b", "x=y", "foo[bar]", "a\\b", "a/b", "1-2-3"])(
    "accepts Avito-whitelisted variantId %s (positive whitelist coverage)",
    async (variantId) => {
      const { errors, onProductError } = collectErrors();
      const result = await renderAvito(
        [validProduct({ productId: 1, variantId })],
        { ...baseOptions, onProductError },
      );
      expect(errors).toEqual([]);
      expect(result).toContain(`<Id>1-${variantId}</Id>`);
    },
  );

  it("reports Id as missing for non-positive or non-integer productId", async () => {
    for (const productId of [0, -1, 1.5]) {
      const { errors, onProductError } = collectErrors();
      await renderAvito([validProduct({ productId })], {
        ...baseOptions,
        onProductError,
      });
      const err = errors[0].errors.find((e) => e.field === "Id");
      expect(err?.reason).toBe("missing");
    }
  });

  it("emits unique <Id> for variants sharing the same variantId across products", async () => {
    // Регрессия на боевой баг (GOAT): variantId == size (число 4..14), и без
    // composite Id два разных productId с одним размером дают одинаковый <Id>,
    // что валит Avito-загрузку как «Дубли ID объявлений».
    const products = [
      validProduct({ productId: 100, variantId: "10" }),
      validProduct({ productId: 200, variantId: "10" }),
      validProduct({ productId: 300, variantId: "10" }),
    ];
    const result = await renderAvito(products, baseOptions);
    const ids = Array.from(result.matchAll(/<Id>([^<]+)<\/Id>/g)).map(
      (m) => m[1],
    );
    expect(ids).toEqual(["100-10", "200-10", "300-10"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to product.sizes when params has no size", async () => {
    const result = await renderAvito(
      [
        validProduct({
          params: [
            { key: "Color", value: "Белый" },
            { key: "ColorName", value: "Молочный" },
          ],
          sizes: [{ name: "RU", value: "42/8.5/26.5", delimiter: "/" }],
        }),
      ],
      baseOptions,
    );
    expect(result).toContain("<Size>42</Size>");
  });

  it("handles empty delimiter in product.sizes without char-by-char split", async () => {
    const result = await renderAvito(
      [
        validProduct({
          params: [
            { key: "Color", value: "Белый" },
            { key: "ColorName", value: "Молочный" },
          ],
          sizes: [{ name: "RU", value: "42", delimiter: "" }],
        }),
      ],
      baseOptions,
    );
    expect(result).toContain("<Size>42</Size>");
  });

  it("reads color/size/colorname from product.properties when params is empty", async () => {
    const product = validProduct({
      params: [],
      properties: [
        { key: "Size", value: "42" },
        { key: "Color", value: "Белый" },
        { key: "ColorName", value: "Молочный" },
      ],
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<Size>42</Size>");
  });

  it("params takes priority over properties when both define same key", async () => {
    const product = validProduct({
      params: [
        { key: "Size", value: "42" },
        { key: "Color", value: "Белый" },
        { key: "ColorName", value: "Молочный" },
      ],
      properties: [
        { key: "Size", value: "999" },
        { key: "Color", value: "Чёрный" },
        { key: "ColorName", value: "Угольный" },
      ],
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<Size>42</Size>");
    expect(result).toContain("<ColorName>Молочный</ColorName>");
    expect(result).not.toContain("Чёрный");
  });

  it("empty value in params does NOT shadow non-empty value in properties", async () => {
    // mapping-transformer может положить плейсхолдер (`{key:'Color',value:''}`)
    // для optional-поля, реальное значение остаётся в properties. Без
    // skip-on-empty в buildParamIndex валидатор репортил бы Color:missing.
    const product = validProduct({
      params: [
        { key: "Size", value: "42" },
        { key: "Color", value: "" },
        { key: "ColorName", value: "  " },
      ],
      properties: [
        { key: "Color", value: "Белый" },
        { key: "ColorName", value: "Молочный" },
      ],
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain("<Color>Белый</Color>");
    expect(result).toContain("<ColorName>Молочный</ColorName>");
  });

  it("trims color value before enum check", async () => {
    const product = validProduct({
      params: [
        { key: "Size", value: "42" },
        { key: "Color", value: "  Белый  " },
        { key: "ColorName", value: "Молочный" },
      ],
    });
    const result = await renderAvito([product], baseOptions);
    expect(result).toContain("<Color>Белый</Color>");
  });

  it("emits empty <Ads> container when products is empty", async () => {
    const result = await renderAvito([], baseOptions);
    expect(result).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(result).toContain("</Ads>");
    expect(result).not.toContain("<Ad>");
  });

  it("does not throw with failOnError default (false) even on all-invalid feed", async () => {
    const { errors, onProductError } = collectErrors();
    await expect(
      renderAvito(
        [
          validProduct({ productId: 1, variantId: "1", vendor: undefined }),
          validProduct({ productId: 2, variantId: "2", vendor: undefined }),
        ],
        { ...baseOptions, onProductError },
      ),
    ).resolves.toBeTruthy();
    expect(errors).toHaveLength(2);
  });
});

describe.each([
  {
    templateId: 100368 as const,
    goodsType: "Мужская обувь",
    apparelType: "Кроссовки",
    schema: SCHEMA_100368,
  },
  {
    templateId: 100388 as const,
    goodsType: "Женская обувь",
    apparelType: "Кроссовки и кеды",
    schema: SCHEMA_100388,
  },
])(
  "AvitoFormatter per-template ($templateId)",
  ({ templateId, goodsType, apparelType, schema }) => {
    const opts: AvitoSneakersFormatterOptions = {
      ...baseOptions,
      templateId,
      goodsType,
      apparelType,
    };

    it("emits correct GoodsType and ApparelType for this template", async () => {
      const result = await renderAvito([validProduct()], opts);
      expect(result).toContain(`<GoodsType>${goodsType}</GoodsType>`);
      expect(result).toContain(`<ApparelType>${apparelType}</ApparelType>`);
    });

    it("rejects goodsType which belongs to a different template", async () => {
      await expect(
        renderAvito([validProduct()], {
          ...opts,
          goodsType: "несуществующий-тип",
        }),
      ).rejects.toThrow(/goodsType="несуществующий-тип"/);
    });

    it("reports invalid_enum reason against template's own colorValues", async () => {
      const { errors, onProductError } = collectErrors();
      const product = validProduct({
        params: [
          { key: "Size", value: "42" },
          { key: "Color", value: "беленький" },
          { key: "ColorName", value: "Беленький" },
        ],
      });
      await renderAvito([product], { ...opts, onProductError });
      const colorErr = errors[0].errors.find((e) => e.field === "Color");
      expect(colorErr?.reason).toBe("invalid_enum");
      expect(colorErr?.expected).toEqual(schema.colorValues);
    });
  },
);
