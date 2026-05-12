/**
 * Справочные значения и required-список для Avito autoload-шаблонов
 * мужских и женских кроссовок (template 100368 / 100388).
 *
 * Снимаются периодически через scripts/fetch-avito-schema.ts из
 * https://www.avito.ru/autoload/documentation/templates/{id}?fileFormat=xml
 * Если Avito поменяет справочник — обновить этот файл.
 */

export const AVITO_REQUIRED_FIELDS = [
  "Id",
  "Title",
  "Description",
  "Category",
  "Price",
  "Images",
  "GoodsType",
  "Condition",
  "AdType",
  "Brand",
  "Color",
  "ColorName",
  "ApparelType",
  "Size",
] as const;

export type AvitoRequiredField = (typeof AVITO_REQUIRED_FIELDS)[number];

export const AVITO_COLOR_VALUES = [
  "Красный",
  "Белый",
  "Розовый",
  "Бордовый",
  "Синий",
  "Жёлтый",
  "Голубой",
  "Фиолетовый",
  "Оранжевый",
  "Разноцветный",
  "Серый",
  "Бежевый",
  "Чёрный",
  "Коричневый",
  "Зелёный",
  "Серебряный",
  "Золотой",
] as const;

export const AVITO_CONDITION_VALUES = [
  "Новое с биркой",
  "Отличное",
  "Хорошее",
  "Удовлетворительное",
] as const;

export const AVITO_AD_TYPE_VALUES = [
  "Товар приобретен на продажу",
  "Товар от производителя",
] as const;

export const AVITO_GOODS_TYPE_VALUES = [
  "Мужская обувь",
  "Женская обувь",
] as const;

export const AVITO_APPAREL_TYPE_VALUES = [
  "Кроссовки",
  "Кеды",
  "Слипоны",
] as const;

export const AVITO_TARGET_AUDIENCE_VALUES = [
  "Частные лица",
  "Бизнес",
  "Частные лица и бизнес",
] as const;

export const AVITO_TEXT_LIMITS = {
  Title: { min: 1, max: 50 },
  Description: { min: 1, max: 7500 },
  ColorName: { min: 1, max: 50 },
  Brand: { min: 1, max: 50 },
} as const;

export const AVITO_PRICE_LIMITS = { min: 1, max: 100_000_000 } as const;

export type AvitoValidationReason =
  | "missing"
  | "invalid_enum"
  | "too_short"
  | "too_long"
  | "out_of_range"
  | "invalid_url"
  | "empty_array";

export interface AvitoValidationError {
  field: AvitoRequiredField | string;
  value: unknown;
  reason: AvitoValidationReason;
  expected?: readonly string[] | { min?: number; max?: number };
}

export interface AvitoProductError {
  productId: number;
  errors: AvitoValidationError[];
}
