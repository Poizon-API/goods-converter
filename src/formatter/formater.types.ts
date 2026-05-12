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

export interface AvitoFormatterOptions {
  category?: string;
  goodsType?: string;
  condition?: string;
  adType?: string;
  apparelType?: string;
  defaultBrand?: string;
  defaultColor?: string;
  defaultColorName?: string;
  defaultSize?: string;
  targetAudience?: string;
}
