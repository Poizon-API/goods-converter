import { XMLBuilder } from "fast-xml-parser";

import { type Product, type Category, type Brand } from "../types";
import { writeWithDrain } from "../utils";
import {
  AVITO_AD_TYPE_VALUES,
  AVITO_APPAREL_TYPE_VALUES,
  AVITO_COLOR_VALUES,
  AVITO_CONDITION_VALUES,
  AVITO_GOODS_TYPE_VALUES,
  AVITO_PRICE_LIMITS,
  AVITO_TARGET_AUDIENCE_VALUES,
  AVITO_TEXT_LIMITS,
  type AvitoProductError,
  type AvitoValidationError,
} from "./Avito.schema";
import {
  Extension,
  type AvitoFormatterOptions,
  type FormatterAbstract,
  type FormatterOptions,
} from "./formater.types";

import { PassThrough, type Writable } from "stream";

const SIZE_KEYS = ["size", "размер", "尺码"];
const COLOR_KEYS = ["color", "цвет", "颜色"];
const COLOR_NAME_KEYS = ["colorname", "color_name", "название цвета"];

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
  Id: number;
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
    this.validateOptions(avitoOptions);

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
    const errors: AvitoProductError[] = [];

    await resultWriter('<?xml version="1.0" encoding="UTF-8"?>\n');
    await resultWriter('<Ads formatVersion="3" target="Avito.ru">\n');

    for (const product of products) {
      const built = this.buildAd(product, avitoOptions);
      if (built.errors.length > 0) {
        const event: AvitoProductError = {
          productId: product.productId,
          errors: built.errors,
        };
        errors.push(event);
        avitoOptions.onProductError?.(event);
        continue;
      }
      await resultWriter(
        this.indent(builder.build({ Ad: built.ad })) + "\n",
      );
    }

    result.end("</Ads>\n");

    if (avitoOptions.failOnError && errors.length > 0) {
      throw new Error(
        `AvitoFormatter: ${errors.length} товаров не прошли валидацию`,
      );
    }
  }

  private validateOptions(options: AvitoFormatterOptions): void {
    if (
      !AVITO_GOODS_TYPE_VALUES.includes(
        options.goodsType as (typeof AVITO_GOODS_TYPE_VALUES)[number],
      )
    ) {
      throw new Error(
        `AvitoFormatter: goodsType="${options.goodsType}" не из справочника ` +
          `${AVITO_GOODS_TYPE_VALUES.join(", ")}`,
      );
    }
    if (
      !AVITO_CONDITION_VALUES.includes(
        options.condition as (typeof AVITO_CONDITION_VALUES)[number],
      )
    ) {
      throw new Error(
        `AvitoFormatter: condition="${options.condition}" не из справочника ` +
          `${AVITO_CONDITION_VALUES.join(", ")}`,
      );
    }
    if (
      !AVITO_AD_TYPE_VALUES.includes(
        options.adType as (typeof AVITO_AD_TYPE_VALUES)[number],
      )
    ) {
      throw new Error(
        `AvitoFormatter: adType="${options.adType}" не из справочника ` +
          `${AVITO_AD_TYPE_VALUES.join(", ")}`,
      );
    }
    if (
      !AVITO_APPAREL_TYPE_VALUES.includes(
        options.apparelType as (typeof AVITO_APPAREL_TYPE_VALUES)[number],
      )
    ) {
      throw new Error(
        `AvitoFormatter: apparelType="${options.apparelType}" не из справочника ` +
          `${AVITO_APPAREL_TYPE_VALUES.join(", ")}`,
      );
    }
    if (
      options.targetAudience !== undefined &&
      !AVITO_TARGET_AUDIENCE_VALUES.includes(
        options.targetAudience as (typeof AVITO_TARGET_AUDIENCE_VALUES)[number],
      )
    ) {
      throw new Error(
        `AvitoFormatter: targetAudience="${options.targetAudience}" не из ` +
          `справочника ${AVITO_TARGET_AUDIENCE_VALUES.join(", ")}`,
      );
    }
  }

  private buildAd(
    product: Product,
    options: AvitoFormatterOptions,
  ): { ad: AvitoAd; errors: AvitoValidationError[] } {
    const errors: AvitoValidationError[] = [];

    const title = product.title?.trim() ?? "";
    if (title.length < AVITO_TEXT_LIMITS.Title.min) {
      errors.push({ field: "Title", value: title, reason: "missing" });
    } else if (title.length > AVITO_TEXT_LIMITS.Title.max) {
      errors.push({
        field: "Title",
        value: title,
        reason: "too_long",
        expected: AVITO_TEXT_LIMITS.Title,
      });
    }

    const description = product.description ?? "";
    if (description.length < AVITO_TEXT_LIMITS.Description.min) {
      errors.push({
        field: "Description",
        value: description,
        reason: "missing",
      });
    } else if (description.length > AVITO_TEXT_LIMITS.Description.max) {
      errors.push({
        field: "Description",
        value: description,
        reason: "too_long",
        expected: AVITO_TEXT_LIMITS.Description,
      });
    }

    const price = product.price ?? 0;
    if (
      typeof price !== "number" ||
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

    const images = this.getImages(product.images);
    if (!images) {
      errors.push({
        field: "Images",
        value: product.images,
        reason: "empty_array",
      });
    }

    const brand = product.vendor?.trim() ?? "";
    if (brand.length < AVITO_TEXT_LIMITS.Brand.min) {
      errors.push({ field: "Brand", value: brand, reason: "missing" });
    } else if (brand.length > AVITO_TEXT_LIMITS.Brand.max) {
      errors.push({
        field: "Brand",
        value: brand,
        reason: "too_long",
        expected: AVITO_TEXT_LIMITS.Brand,
      });
    }

    const rawColor = this.findParamValue(product, COLOR_KEYS);
    if (!rawColor) {
      errors.push({ field: "Color", value: rawColor, reason: "missing" });
    } else if (
      !AVITO_COLOR_VALUES.includes(
        rawColor as (typeof AVITO_COLOR_VALUES)[number],
      )
    ) {
      errors.push({
        field: "Color",
        value: rawColor,
        reason: "invalid_enum",
        expected: AVITO_COLOR_VALUES,
      });
    }

    const colorName =
      this.findParamValue(product, COLOR_NAME_KEYS)?.trim() ?? "";
    if (colorName.length < AVITO_TEXT_LIMITS.ColorName.min) {
      errors.push({ field: "ColorName", value: colorName, reason: "missing" });
    } else if (colorName.length > AVITO_TEXT_LIMITS.ColorName.max) {
      errors.push({
        field: "ColorName",
        value: colorName,
        reason: "too_long",
        expected: AVITO_TEXT_LIMITS.ColorName,
      });
    }

    const size = this.getSize(product);
    if (!size) {
      errors.push({ field: "Size", value: size, reason: "missing" });
    }

    const ad: AvitoAd = {
      Id: product.variantId,
      Title: title,
      Description: { __cdata: this.getSafeCdata(description) },
      Category: options.category,
      Price: price,
      Images: images ?? { Image: [] },
      GoodsType: options.goodsType,
      Condition: options.condition,
      AdType: options.adType,
      Brand: brand,
      Color: rawColor ?? "",
      ColorName: colorName,
      ApparelType: options.apparelType,
      Size: size ?? "",
    };

    if (options.targetAudience) {
      ad.TargetAudience = options.targetAudience;
    }

    return { ad, errors };
  }

  private getImages(images?: string[]): AvitoImages | undefined {
    const avitoImages = images
      ?.map((url) => url.trim())
      .filter((url) => url.length > 0 && this.isValidUrl(url))
      .map((url) => ({ "@_url": url }));

    if (!avitoImages?.length) {
      return undefined;
    }
    return { Image: avitoImages };
  }

  private getSize(product: Product): string | undefined {
    const paramSize = this.findParamValue(product, SIZE_KEYS)?.trim();
    if (paramSize) return paramSize;

    const size = product.sizes?.find((item) => item.value.trim().length > 0);
    if (!size) return undefined;
    return this.getFirstDelimitedValue(size.value, size.delimiter);
  }

  private findParamValue(
    product: Product,
    keys: readonly string[],
  ): string | undefined {
    const normalizedKeys = keys.map((key) => this.normalizeKey(key));
    const params = [...(product.params ?? []), ...(product.properties ?? [])];

    return params.find((param) =>
      normalizedKeys.includes(this.normalizeKey(param.key)),
    )?.value;
  }

  private normalizeKey(value: string): string {
    return value.trim().toLowerCase();
  }

  private getFirstDelimitedValue(value: string, delimiter: string): string {
    const [firstValue] = value.split(delimiter);
    return firstValue.trim();
  }

  private getSafeCdata(value: string): string {
    return value.replaceAll("]]>", "]]]]><![CDATA[>");
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  private indent(value: string): string {
    return value
      .trimEnd()
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
  }
}
