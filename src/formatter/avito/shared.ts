/**
 * Общая инфраструктура для всех Avito-форматтеров (вне зависимости от
 * категории/template'а). Per-template схемы — в `templates/*.ts`.
 */

/**
 * Avito autoload: цена ∈ [1, 100_000_000] руб. — это лимит платформы, не
 * категории (autoload-фид принимает только RUB).
 */
export const AVITO_PRICE_LIMITS = { min: 1, max: 100_000_000 } as const;

/**
 * Лимит длины `<Id>` из Avito-доки (snapshot.groups[].fields[Id].description):
 * «Всего — не более 100 знаков».
 */
export const AVITO_ID_MAX_LENGTH = 100;

/**
 * Допустимые символы в `<Id>` (из Avito-доки): цифры, английские и русские
 * (кроме ё) буквы, плюс символы `, \ / ( ) [ ] - =`. Подчёркивание `_` НЕ
 * входит. Регулярка проверяет одну часть composite-id (productId либо
 * variantId по отдельности — соединительный `-` валиден внутри обеих частей,
 * но для UX мы просто требуем, чтобы каждая часть была непустая и из
 * whitelist'а).
 */
export const AVITO_ID_PART_PATTERN = /^[0-9A-Za-zА-Яа-я,\\/()[\]\-=]+$/u;

export type AvitoValidationReason =
  | "missing"
  | "invalid_enum"
  | "too_short"
  | "too_long"
  | "out_of_range"
  | "invalid_url"
  | "empty_array";

export type AvitoValidationField =
  | "Id"
  | "Title"
  | "Description"
  | "Price"
  | "Images"
  | "Brand"
  | "Color"
  | "ColorName"
  | "Size";

export interface AvitoValidationError {
  field: AvitoValidationField;
  value: unknown;
  reason: AvitoValidationReason;
  expected?: readonly string[] | { min?: number; max?: number };
}

export interface AvitoProductError {
  productId: number;
  errors: AvitoValidationError[];
}

/**
 * Type guard: проверяет, что `value` входит в readonly-tuple `list`.
 * Используется вместо паттерна `list.includes(value as T)` чтобы не плодить
 * `as`-касты на каждом call-site валидатора. Cast-free реализация.
 */
export function isOneOf<T extends string>(
  value: string | undefined,
  list: readonly T[],
): value is T {
  if (value === undefined) return false;
  return list.some((allowed) => allowed === value);
}

/**
 * Per-template схема Avito autoload-категории. Каждый template (100368,
 * 100388, …) имеет свой набор enum-значений и required-полей; они снимаются
 * из snapshot'а схемы (`src/formatter/avito/snapshots/avito-schema-<id>.json`)
 * и должны с ним совпадать — за этим следит `test/avitoSchemaSync.spec.ts`.
 */
export interface AvitoCategorySchema {
  templateId: number;
  /** Имя категории в дереве Avito (для документации/debug). */
  nodeName: string;
  /** XML-теги, обязательные для template'а (например, `Address` для одних, не для других). */
  requiredFields: readonly string[];
  goodsTypeValues: readonly string[];
  apparelTypeValues: readonly string[];
  colorValues: readonly string[];
  conditionValues: readonly string[];
  /**
   * Допустимые значения тега `<AdType>`. Важно: Avito использует NBSP (U+00A0)
   * внутри этих строк — например, `"Товар от производителя"`. Передавать
   * обычный пробел нельзя, Avito отвергнет.
   */
  adTypeValues: readonly string[];
  /** Допустимые значения тега `<TargetAudience>` (опциональное поле). */
  targetAudienceValues: readonly string[];
  /**
   * XML-теги, которые формattер читает из `product.params` (а не из прямых
   * полей `Product`). Это «mapping-поверхность» — потребители (например,
   * export-api) разворачивают по этому списку UI mapping'а target-ключей.
   * Для текущих sneakers-template'ов: Color, ColorName, Size.
   */
  paramTags: readonly string[];
  /** Лимиты длины для текстовых полей. */
  textLimits: {
    readonly Title: { readonly min: number; readonly max: number };
    readonly Description: { readonly min: number; readonly max: number };
    readonly Brand: { readonly min: number; readonly max: number };
    readonly ColorName: { readonly min: number; readonly max: number };
  };
  /**
   * Справочник допустимых значений `<Size>` для template'а (см. `values_link`
   * в `externalValues.Size` snapshot'а, пример URL для 100368:
   * https://www.avito.ru/web/1/autoload/user-docs/category/100368/field/115164/values-xml).
   * Запятая — десятичный разделитель Avito (`36,5`); formatter нормализует
   * `.` → `,` перед проверкой.
   *
   * Если поле не задано (или пустой массив) — formatter сверку не делает,
   * товар отбраковывается только при отсутствующем Size. Это back-compat
   * для template'ов, чей справочник пока не выкачан.
   */
  sizeValues?: readonly string[];
}
