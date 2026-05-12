import { type Brand, type Category, type Product } from "../types";

import { type Writable } from "stream";

export abstract class FormatterAbstract {
  public abstract formatterName: string;
  public abstract fileExtension: Extension;

  public abstract format(
    writableStream: Writable,
    products: Product[],
    categories?: Category[],
    brands?: Brand[],
    option?: FormatterOptions,
  ): Promise<void>;
}

export interface FormatterOptions {
  shopName?: string;

  companyName?: string;

  splitParams?: boolean;

  avito?: AvitoFormatterOptions;
}

export enum Extension {
  CSV = "csv",
  YML = "yml",
  XML = "xml",
  XLSX = "xlsx",
  JSON = "json",
}

import { type AvitoProductError } from "./Avito.schema";

/**
 * Опции форматтера Avito. Все *required*-поля шаблона должны быть переданы
 * caller'ом — форматтер сам ничего не угадывает и не подставляет дефолты.
 * Если значение не из справочника Avito — товар не попадёт в XML, вместо
 * этого вызовется `onProductError`.
 */
export interface AvitoFormatterOptions {
  /** Категория в таксономии Avito, например "Одежда, обувь, аксессуары". */
  category: string;
  /** Тип товара. Из справочника AVITO_GOODS_TYPE_VALUES. */
  goodsType: string;
  /** Состояние товара. Из справочника AVITO_CONDITION_VALUES. */
  condition: string;
  /** Тип объявления. Из справочника AVITO_AD_TYPE_VALUES. */
  adType: string;
  /** Вид одежды/обуви. Из справочника AVITO_APPAREL_TYPE_VALUES. */
  apparelType: string;
  /** Целевая аудитория (тип покупателя). Опционально. */
  targetAudience?: string;
  /**
   * Если true — при первом невалидном товаре `format(...)` бросит ошибку.
   * По умолчанию false: невалидные товары просто пропускаются и emit'ятся
   * через `onProductError`.
   */
  failOnError?: boolean;
  /** Callback на каждый невалидный товар. */
  onProductError?: (event: AvitoProductError) => void;
}

