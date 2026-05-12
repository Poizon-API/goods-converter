import { XMLBuilder } from "fast-xml-parser";

import { type Product, type Category, type Brand } from "../types";
import { writeWithDrain } from "../utils";
import {
  Extension,
  type AvitoFormatterOptions,
  type FormatterAbstract,
  type FormatterOptions,
} from "./formater.types";

import { PassThrough, type Writable } from "stream";

const DEFAULT_AVITO_OPTIONS: Required<AvitoFormatterOptions> = {
  category: "Одежда, обувь, аксессуары",
  goodsType: "Мужская обувь",
  condition: "Новое",
  adType: "Товар приобретен на продажу",
  apparelType: "Кроссовки",
  defaultBrand: "Без бренда",
  defaultColor: "Белый",
  defaultColorName: "Белый",
  defaultSize: "42",
  targetAudience: "",
};

const SIZE_KEYS = ["size", "размер", "尺码"];
const COLOR_KEYS = ["color", "цвет", "颜色"];
const COLOR_NAME_KEYS = ["colorname", "color_name", "название цвета"];

const COLOR_ALIASES: Record<string, string> = {
  black: "Черный",
  blue: "Синий",
  brown: "Коричневый",
  green: "Зеленый",
  grey: "Серый",
  gray: "Серый",
  orange: "Оранжевый",
  pink: "Розовый",
  purple: "Фиолетовый",
  red: "Красный",
  white: "Белый",
  yellow: "Желтый",
  бежевый: "Бежевый",
  белый: "Белый",
  голубой: "Голубой",
  желтый: "Желтый",
  зеленый: "Зеленый",
  золотой: "Золотой",
  коричневый: "Коричневый",
  красный: "Красный",
  мультиколор: "Мультиколор",
  оранжевый: "Оранжевый",
  розовый: "Розовый",
  серебряный: "Серебряный",
  серый: "Серый",
  синий: "Синий",
  фиолетовый: "Фиолетовый",
  черный: "Черный",
};

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
  Images?: AvitoImages;
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
    const avitoOptions = this.getOptions(options?.avito);

    await resultWriter('<?xml version="1.0" encoding="UTF-8"?>\n');
    await resultWriter('<Ads formatVersion="3" target="Avito.ru">\n');

    for (const product of products) {
      if (product.price === 0) continue;

      await resultWriter(
        this.indent(builder.build({ Ad: this.getAd(product, avitoOptions) })) +
          "\n",
      );
    }

    result.end("</Ads>\n");
  }

  private getOptions(
    options?: AvitoFormatterOptions,
  ): Required<AvitoFormatterOptions> {
    return {
      ...DEFAULT_AVITO_OPTIONS,
      ...options,
    };
  }

  private getAd(
    product: Product,
    options: Required<AvitoFormatterOptions>,
  ): AvitoAd {
    const rawColor = this.findParamValue(product, COLOR_KEYS);
    const colorName = this.findParamValue(product, COLOR_NAME_KEYS) ?? rawColor;
    const images = this.getImages(product.images);

    const ad: AvitoAd = {
      Id: product.variantId,
      Title: product.title,
      Description: {
        __cdata: this.getSafeCdata(product.description),
      },
      Category: options.category,
      Price: product.price,
      Images: images,
      GoodsType: this.getGoodsType(product, options),
      Condition: options.condition,
      AdType: options.adType,
      Brand: product.vendor ?? options.defaultBrand,
      Color: rawColor ? this.normalizeColor(rawColor) : options.defaultColor,
      ColorName: colorName ?? options.defaultColorName,
      ApparelType: options.apparelType,
      Size: this.getSize(product) ?? options.defaultSize,
    };

    const targetAudience =
      options.targetAudience || this.getTargetAudience(product);
    if (targetAudience) {
      ad.TargetAudience = targetAudience;
    }

    return ad;
  }

  private getImages(images?: string[]): AvitoImages | undefined {
    const avitoImages = images
      ?.map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => ({
        "@_url": url,
      }));

    if (!avitoImages?.length) {
      return undefined;
    }

    return { Image: avitoImages };
  }

  private getSize(product: Product): string | undefined {
    const paramSize = this.findParamValue(product, SIZE_KEYS);
    if (paramSize) {
      return paramSize;
    }

    const size = product.sizes?.find((item) => item.value.trim().length > 0);
    if (!size) {
      return undefined;
    }

    return this.getFirstDelimitedValue(size.value, size.delimiter);
  }

  private getGoodsType(
    product: Product,
    options: Required<AvitoFormatterOptions>,
  ): string {
    if (this.isFemale(product.gender)) {
      return "Женская обувь";
    }

    return options.goodsType;
  }

  private getTargetAudience(product: Product): string | undefined {
    if (!product.gender) {
      return undefined;
    }

    if (this.isFemale(product.gender)) {
      return "Женщины";
    }

    if (this.isMale(product.gender)) {
      return "Мужчины";
    }

    return product.gender;
  }

  private isFemale(gender?: string): boolean {
    return this.normalizeKey(gender ?? "").includes("жен");
  }

  private isMale(gender?: string): boolean {
    return this.normalizeKey(gender ?? "").includes("муж");
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

  private normalizeColor(color: string): string {
    return COLOR_ALIASES[this.normalizeKey(color)] ?? color;
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

  private indent(value: string): string {
    return value
      .trimEnd()
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
  }
}
