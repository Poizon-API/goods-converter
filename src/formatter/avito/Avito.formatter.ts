import { XMLBuilder } from "fast-xml-parser";

import { type Product, type Category, type Brand } from "../../types";
import { writeWithDrain } from "../../utils";
import {
  Extension,
  type FormatterAbstract,
  type FormatterOptions,
} from "../formater.types";
import {
  clampPartialHtml,
  sanitizeAvitoDescription,
} from "./sanitizeDescription";
import {
  AVITO_ID_MAX_LENGTH,
  AVITO_ID_PART_PATTERN,
  AVITO_PRICE_LIMITS,
  isOneOf,
  type AvitoCategorySchema,
  type AvitoProductError,
  type AvitoValidationError,
} from "./shared";
import { TEMPLATE_REGISTRY } from "./templates";
import {
  type AvitoSneakersFormatterOptions,
  type AvitoTextOverflowPolicy,
} from "./types";

import { PassThrough, type Writable } from "stream";

interface AvitoImage {
  "@_url": string;
}

interface AvitoCdata {
  __cdata: string;
}

interface AvitoImages {
  Image: AvitoImage[];
}

interface AvitoAd {
  Id: string;
  Title: string;
  Description: AvitoCdata;
  Category: string;
  Price: number;
  Images: AvitoImages;
  GoodsType: string;
  Condition: string;
  AdType: string;
  Brand: string;
  Color: string;
  ColorName: string;
  ApparelType: string;
  Size: string;
  TargetAudience?: string;
  Address?: string;
}

type ImagesResult =
  | { kind: "ok"; images: AvitoImages }
  | { kind: "missing" }
  | { kind: "empty_array" }
  | { kind: "invalid_url" };

/**
 * Проверяет, что значение представимо как валидный сегмент Avito `<Id>`. Для
 * number'ов дополнительно требуем positive integer — иначе ноль/отрицательные/
 * float (`1.5` → "1.5" → `.` мимо whitelist'а, но семантически тоже missing)
 * пропускались бы только по совпадению с regex. Stringified-форма прогоняется
 * через whitelist всегда — это ловит `1e21` (`Number.isInteger` пропускает,
 * но `String(1e21) === "1e+21"` с `+` не входит в whitelist).
 */
function isValidIdSegment(value: string | number): boolean {
  if (typeof value === "number" && (!Number.isInteger(value) || value <= 0)) {
    return false;
  }
  return AVITO_ID_PART_PATTERN.test(String(value));
}

export class AvitoFormatter implements FormatterAbstract {
  public formatterName = "Avito";
  public fileExtension = Extension.XML;

  public async format(
    writableStream: Writable,
    products: Product[],
    _categories?: Category[],
    _brands?: Brand[],
    options?: FormatterOptions,
  ): Promise<void> {
    const avitoOptions = options?.avito;
    if (!avitoOptions) {
      throw new Error(
        "AvitoFormatter requires `options.avito` with category/goodsType/" +
          "condition/adType/apparelType",
      );
    }
    const schema = TEMPLATE_REGISTRY[avitoOptions.templateId];
    if (!schema) {
      throw new Error(
        `AvitoFormatter: templateId=${avitoOptions.templateId} не поддерживается. ` +
          `Доступные: ${Object.keys(TEMPLATE_REGISTRY).join(", ")}`,
      );
    }
    this.validateOptions(avitoOptions, schema);

    const result = new PassThrough();
    result.pipe(writableStream);

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      cdataPropName: "__cdata",
      format: true,
      indentBy: "  ",
      suppressEmptyNode: true,
    });

    const resultWriter = writeWithDrain(result);

    await resultWriter('<?xml version="1.0" encoding="UTF-8"?>\n');
    await resultWriter('<Ads formatVersion="3" target="Avito.ru">\n');

    for (const product of products) {
      const built = this.buildAd(product, avitoOptions, schema);
      if (built.errors.length > 0) {
        const event: AvitoProductError = {
          productId: product.productId,
          errors: built.errors,
        };
        avitoOptions.onProductError?.(event);
        if (avitoOptions.failOnError) {
          // Без destroy() pipe (S3 / fs.WriteStream) успевает корректно
          // закрыть destination с partial-feed'ом ДО того, как promise
          // format() отклонится — consumer считает upload удачным. Node
          // pipe по умолчанию НЕ пробрасывает 'error' с source, поэтому
          // делаем explicit: отвязываем pipe, кидаем 'error' в
          // writableStream и убиваем внутренний PassThrough без ошибки
          // (свою уже выбросим throw'ом ниже).
          const err = new Error(
            `AvitoFormatter: товар productId=${product.productId} ` +
              `не прошёл валидацию (failOnError=true)`,
          );
          result.unpipe(writableStream);
          writableStream.destroy(err);
          result.destroy();
          throw err;
        }
        continue;
      }
      await resultWriter(this.indent(builder.build({ Ad: built.ad })) + "\n");
    }

    // .end(chunk) сам по себе не возвращает promise. Без await consumer'у,
    // который сразу после resolve format() начинает читать destination
    // (например, S3 multipart, где upload завершается лениво), может
    // достаться неполный фид. Дожидаемся 'finish' (или 'error') downstream'а.
    await new Promise<void>((resolve, reject) => {
      result.once("finish", () => {
        resolve();
      });
      result.once("error", reject);
      result.end("</Ads>\n");
    });
  }

  private validateOptions(
    options: AvitoSneakersFormatterOptions,
    schema: AvitoCategorySchema,
  ): void {
    if (!options.category?.trim()) {
      throw new Error(
        "AvitoFormatter: option `category` обязателен и не должен быть пустой строкой",
      );
    }
    this.requireEnumValue(
      "goodsType",
      options.goodsType,
      schema.goodsTypeValues,
    );
    this.requireEnumValue(
      "condition",
      options.condition,
      schema.conditionValues,
    );
    this.requireEnumValue("adType", options.adType, schema.adTypeValues);
    this.requireEnumValue(
      "apparelType",
      options.apparelType,
      schema.apparelTypeValues,
    );
    if (options.targetAudience !== undefined) {
      this.requireEnumValue(
        "targetAudience",
        options.targetAudience,
        schema.targetAudienceValues,
      );
    }
  }

  private requireEnumValue<T extends string>(
    name: string,
    value: string,
    allowed: readonly T[],
  ): void {
    if (!isOneOf(value, allowed)) {
      throw new Error(
        `AvitoFormatter: ${name}="${value}" не из справочника ` +
          `${allowed.join(", ")}`,
      );
    }
  }

  private buildAd(
    product: Product,
    options: AvitoSneakersFormatterOptions,
    schema: AvitoCategorySchema,
  ): { ad: AvitoAd; errors: AvitoValidationError[] } {
    const errors: AvitoValidationError[] = [];
    const paramIndex = this.buildParamIndex(product);

    const id = this.buildAvitoId(product, errors);

    const rawTitle = product.title?.trim() ?? "";
    const title = this.applyOverflowPolicy(
      "Title",
      rawTitle,
      schema.textLimits.Title,
      options.titleOverflowPolicy,
    );
    this.validateTextField("Title", title, schema.textLimits.Title, errors);

    // Whitespace-only description должен трактоваться как missing — иначе
    // Avito реджектит ad на upload-стороне без понятной причины (наш
    // validateTextField без trim'а пускает length=3).
    const rawDescription = product.description?.trim() ?? "";
    const sanitizedDescription = sanitizeAvitoDescription(rawDescription);
    const truncatedDescription = this.applyOverflowPolicy(
      "Description",
      sanitizedDescription,
      schema.textLimits.Description,
      options.descriptionOverflowPolicy,
    );
    // applyOverflowPolicy режет по символам без знания HTML — может
    // оборвать тег `<p` или entity `&am` посередине. На стороне Avito
    // CDATA-content декодится как HTML: оборванный тег ignored по
    // eof-in-tag (whatwg.org/html parser), оборванный entity рендерится
    // литералом. clampPartialHtml снимает trailing partial fragment;
    // длина после clamp ≤ truncate, validateTextField проверит min.
    const description = clampPartialHtml(truncatedDescription);
    this.validateTextField(
      "Description",
      description,
      schema.textLimits.Description,
      errors,
    );

    const price = product.price ?? 0;
    // Number.isFinite вместо `typeof === "number"` — последний пускает NaN
    // (`typeof NaN === "number"`), а NaN < min и NaN > max оба false по
    // IEEE-754, поэтому невалидная цена проходила бы валидацию и улетала в
    // <Price>NaN</Price>. Number.isFinite одной проверкой режет NaN, ±Infinity
    // и не-numbers.
    if (
      !Number.isFinite(price) ||
      price < AVITO_PRICE_LIMITS.min ||
      price > AVITO_PRICE_LIMITS.max
    ) {
      errors.push({
        field: "Price",
        value: price,
        reason: "out_of_range",
        expected: AVITO_PRICE_LIMITS,
      });
    }

    const imagesResult = this.getImages(product.images);
    if (imagesResult.kind !== "ok") {
      errors.push({
        field: "Images",
        value: product.images,
        reason: imagesResult.kind,
      });
    }

    const brand = product.vendor?.trim() ?? "";
    this.validateTextField("Brand", brand, schema.textLimits.Brand, errors);

    const rawColor = paramIndex.get("Color")?.trim() ?? "";
    if (!rawColor) {
      errors.push({ field: "Color", value: rawColor, reason: "missing" });
    } else if (!isOneOf(rawColor, schema.colorValues)) {
      errors.push({
        field: "Color",
        value: rawColor,
        reason: "invalid_enum",
        expected: schema.colorValues,
      });
    }

    const colorName = paramIndex.get("ColorName")?.trim() ?? "";
    this.validateTextField(
      "ColorName",
      colorName,
      schema.textLimits.ColorName,
      errors,
    );

    const rawSize = this.getSize(product, paramIndex);
    // Avito ждёт `36,5` (запятая), а адаптеры/каталоги обычно отдают `36.5`
    // (точка). Нормализуем replaceAll, чтобы мусорный multi-dot ('38.5.5') не
    // протёк дальше с частично-заменённой точкой.
    const size = rawSize?.replaceAll(".", ",");
    if (!size) {
      errors.push({ field: "Size", value: size, reason: "missing" });
    } else if (
      schema.sizeValues &&
      schema.sizeValues.length > 0 &&
      !isOneOf(size, schema.sizeValues)
    ) {
      errors.push({
        field: "Size",
        value: size,
        reason: "invalid_enum",
        expected: schema.sizeValues,
      });
    }

    const ad: AvitoAd = {
      Id: id,
      Title: title,
      Description: { __cdata: this.getSafeCdata(description) },
      Category: options.category,
      Price: price,
      Images: imagesResult.kind === "ok" ? imagesResult.images : { Image: [] },
      GoodsType: options.goodsType,
      Condition: options.condition,
      AdType: options.adType,
      Brand: brand,
      Color: rawColor,
      ColorName: colorName,
      ApparelType: options.apparelType,
      Size: size ?? "",
    };

    if (options.targetAudience) {
      ad.TargetAudience = options.targetAudience;
    }
    if (options.address) {
      ad.Address = options.address;
    }

    return { ad, errors };
  }

  /**
   * Возвращает значение для `validateTextField` согласно policy; throw'ит при
   * `fail`. Лимит трактуется как UTF-16 code units (`.length` consistent c
   * validateTextField). Truncate-ветка дополнительно сбрасывает trailing lone
   * surrogate, если slice прошёл посередине pair'а — XML 1.0 §2.2 запрещает
   * D800-DFFF в content, lone surrogate сделает фид невалидным.
   */
  private applyOverflowPolicy(
    field: "Title" | "Description",
    value: string,
    limits: { readonly min: number; readonly max: number },
    policy?: AvitoTextOverflowPolicy,
  ): string {
    if (value.length <= limits.max) return value;
    switch (policy) {
      case "truncate": {
        let sliced = value.slice(0, limits.max);
        const lastCode = sliced.charCodeAt(sliced.length - 1);
        if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
          sliced = sliced.slice(0, -1);
        }
        const wordBoundary = sliced.replace(/\s+\S*$/, "").trim();
        // Non-empty guard: первое слово длиннее max'а даст пустой
        // wordBoundary → fallback на sliced.trim() (грубо посреди слова,
        // но лучше чем уронить товар на validateTextField=missing).
        const fallback = sliced.trim();
        return wordBoundary.length > 0 && wordBoundary.length >= limits.min
          ? wordBoundary
          : fallback;
      }
      case "fail":
        // Без preview value — на текстовых полях легально лежит PII
        // (телефоны/адреса), не тащим в Sentry/логи (CWE-209/532).
        throw new Error(
          `AvitoFormatter: ${field} length=${value.length} > max=${limits.max} (policy="fail")`,
        );
      case "skip":
      case undefined:
        return value;
      default: {
        const _exhaustive: never = policy;
        return _exhaustive;
      }
    }
  }

  private validateTextField(
    field: AvitoValidationError["field"],
    value: string,
    limits: { readonly min: number; readonly max: number },
    errors: AvitoValidationError[],
  ): void {
    if (value.length === 0) {
      errors.push({ field, value, reason: "missing" });
    } else if (value.length < limits.min) {
      errors.push({ field, value, reason: "too_short", expected: limits });
    } else if (value.length > limits.max) {
      errors.push({ field, value, reason: "too_long", expected: limits });
    }
  }

  private getImages(images?: string[]): ImagesResult {
    if (images === undefined) return { kind: "missing" };
    if (!Array.isArray(images) || images.length === 0) {
      return { kind: "empty_array" };
    }
    // Avito-валидатор отбивает дубли отдельным сообщением на каждое
    // объявление; не полагаемся на upstream — дедупим у себя по trim'нутому
    // url, чтобы и пробельные дубли отсеялись.
    const valid: AvitoImage[] = [];
    const seen = new Set<string>();
    for (const raw of images) {
      if (typeof raw !== "string") continue;
      const url = raw.trim();
      if (url.length === 0 || !this.isValidUrl(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      valid.push({ "@_url": url });
    }
    if (valid.length === 0) return { kind: "invalid_url" };
    return { kind: "ok", images: { Image: valid } };
  }

  /**
   * Composite <Id> = `${productId}-${variantId}`: Avito требует уникальный Id
   * в фиде, а у нас variantId может совпадать между разными товарами (для
   * GOAT-адаптера это размер). Avito-доку (snapshot.groups[].fields[Id]):
   * до 100 знаков; допустимые символы — цифры, русские/английские буквы,
   * а также `, \ / ( ) [ ] - =`. Подчёркивание `_` Avito не принимает.
   * Сам разделитель `-` входит в whitelist, поэтому composite валиден если
   * обе части тоже из whitelist'а и непустые.
   *
   * Валидация прогоняется по stringified-форме обеих частей: number'ы > 1e21
   * (`Number.isInteger` пропускает, но `String(1e21) === "1e+21"` с `+` мимо
   * whitelist'а) дали бы silent-pass на integer-проверке и mismatch с тем,
   * что попадает в XML.
   */
  private buildAvitoId(
    product: Product,
    errors: AvitoValidationError[],
  ): string {
    const composite = `${product.productId}-${product.variantId}`;
    if (
      !isValidIdSegment(product.productId) ||
      !isValidIdSegment(product.variantId)
    ) {
      errors.push({ field: "Id", value: composite, reason: "missing" });
      return "";
    }
    if (composite.length > AVITO_ID_MAX_LENGTH) {
      errors.push({
        field: "Id",
        value: composite,
        reason: "too_long",
        expected: { min: 1, max: AVITO_ID_MAX_LENGTH },
      });
      return "";
    }
    return composite;
  }

  private getSize(
    product: Product,
    paramIndex: Map<string, string>,
  ): string | undefined {
    const paramSize = paramIndex.get("Size")?.trim();
    if (paramSize) return paramSize;

    const size = product.sizes?.find((item) => item.value.trim().length > 0);
    if (!size) return undefined;
    // Пустой delimiter ломает split('') (разбирает строку посимвольно).
    const delimiter = size.delimiter || "/";
    return this.getFirstDelimitedValue(size.value, delimiter);
  }

  /**
   * Index по `product.params` + `product.properties`: ключ — exact (case-
   * sensitive) Avito tag, значение — raw из feed'а. mapping-transformer на
   * предыдущем этапе обязан положить значения под exact tag-имена
   * (`Color`/`Size`/`ColorName`), иначе формattер сюда не попадёт. `params`
   * имеет приоритет над `properties`, но только при непустом значении —
   * empty/whitespace в params трактуется как «не задано» и не шитит ключ от
   * fallback'а в properties (иначе плейсхолдер из mapping'а перекрыл бы
   * реальное значение и валидатор зарепортил бы missing).
   */
  private buildParamIndex(product: Product): Map<string, string> {
    const index = new Map<string, string>();
    const lists = [product.params, product.properties];
    for (const list of lists) {
      if (!list) continue;
      for (const param of list) {
        if (typeof param?.key !== "string") continue;
        if (typeof param?.value !== "string") continue;
        if (param.value.trim().length === 0) continue;
        if (!index.has(param.key)) index.set(param.key, param.value);
      }
    }
    return index;
  }

  private getFirstDelimitedValue(value: string, delimiter: string): string {
    const [firstValue] = value.split(delimiter);
    return firstValue.trim();
  }

  /**
   * `]]>` нельзя экранировать внутри CDATA (XML 1.0 §2.7 запрещает nesting),
   * поэтому канонический трюк — разрыв секции: закрываем `]]>` и тут же
   * открываем новый `<![CDATA[>`. См. https://www.w3.org/TR/xml/#sec-cdata-sect
   *
   * Belt-and-suspenders: sanitizeAvitoDescription уже entity-эскейпит `>` →
   * `&gt;` в text-nodes, поэтому literal `]]>` в normal-path до этого
   * метода не доходит. Метод остаётся как защита на случай bypass'а
   * санитизации (новый caller, edge-case в sanitize-html, и т.п.) — XML
   * 1.0 §2.7 нарушение фатально для парсера, цена защиты — три строки.
   */
  private getSafeCdata(value: string): string {
    if (!value.includes("]]>")) return value;
    return value.replaceAll("]]>", "]]]]><![CDATA[>");
  }

  /**
   * WHATWG URL парсит `"https:image1"` как `https://image1/` — без буквальной
   * `//` после схемы degenerate URLs проходят. Поэтому проверяем префикс
   * regex'ом отдельно, плюс требуем непустой `host`.
   */
  private isValidUrl(value: string): boolean {
    if (!/^https?:\/\//i.test(value)) return false;
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.host.length > 0
      );
    } catch {
      return false;
    }
  }

  private indent(value: string): string {
    const trimmed = value.trimEnd();
    if (trimmed.length === 0) return trimmed;
    // split/join вместо regex /^/gm: zero-width match в replace eagerly
    // аллоцирует массив всех позиций матчей плюс substring между ними,
    // на потоке тысяч ad'ов это лишний overhead.
    return "  " + trimmed.split("\n").join("\n  ");
  }
}
