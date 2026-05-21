import { type AvitoCategorySchema } from "../shared";

/**
 * Поля и enum'ы, общие для всех sneakers-template'ов Avito autoload (100368 —
 * мужская обувь, 100388 — женская). Различаются между category-template'ами
 * только `templateId`, `nodeName`, `goodsTypeValues`, `apparelTypeValues` —
 * это передаётся в `buildSneakersSchema` каждым `<id>.ts`. Sync с snapshot'ом
 * проверяет `test/avitoSchemaSync.spec.ts`; значения тут должны байт-в-байт
 * совпадать с `src/formatter/avito/snapshots/avito-schema-<id>.json` (включая
 * NBSP в `SNEAKERS_AD_TYPE_VALUES`).
 */

const SNEAKERS_REQUIRED_FIELDS = [
  "AdType",
  "Address",
  "ApparelType",
  "Brand",
  "Category",
  "Color",
  "ColorName",
  "Condition",
  "Description",
  "GoodsType",
  "Id",
  "Images",
  "Price",
  "Size",
  "Title",
] as const;

// Utility-обувь (спорт/рабочая/резиновая/домашняя): Avito-дока помечает Color
// как optional и не объявляет ColorName в схеме вообще. Sync-тест требует
// строгого соответствия snapshot'у; формattер всё равно пишет ColorName в XML
// и Avito-валидатор это молча пропускает (эмпирически проверено через
// xmlcheck/, см. docs/avito-templates-audit.md в export-api), поэтому
// отдельный builder/AvitoAd-shape не нужен — достаточно убрать Color/ColorName
// из requiredFields для drift-чека.
const UTILITY_SHOES_REQUIRED_FIELDS = [
  "AdType",
  "Address",
  "ApparelType",
  "Brand",
  "Category",
  "Condition",
  "Description",
  "GoodsType",
  "Id",
  "Images",
  "Price",
  "Size",
  "Title",
] as const;

const SNEAKERS_COLOR_VALUES = [
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

const SNEAKERS_CONDITION_VALUES = [
  "Новое с биркой",
  "Отличное",
  "Хорошее",
  "Удовлетворительное",
] as const;

// Avito использует NBSP (U+00A0) между словами этих строк. Обычный пробел
// Avito отвергает; см. AvitoCategorySchema.adTypeValues JSDoc и regress-тест
// в test/Avito.test.ts. Пишем через \u00A0-escape, чтобы (а) eslint
// no-irregular-whitespace не ругался на литеральный NBSP, (б) случайный
// find&replace в IDE не «починил» NBSP на обычный пробел.
const SNEAKERS_AD_TYPE_VALUES = [
  "Товар приобретен на\u00A0продажу",
  "Товар от\u00A0производителя",
] as const;

const SNEAKERS_TARGET_AUDIENCE_VALUES = [
  "Частные лица",
  "Бизнес",
  "Частные лица и бизнес",
] as const;

// XML-теги, которые AvitoFormatter.buildParamIndex читает из product.params
// (см. Avito.formatter.ts). Все остальные теги формируются из прямых полей
// Product или из option'ов формattера. Если поведение buildParamIndex
// меняется — синхронизировать этот список.
const SNEAKERS_PARAM_TAGS = ["Color", "ColorName", "Size"] as const;

const SNEAKERS_TEXT_LIMITS = {
  Title: { min: 1, max: 50 },
  Description: { min: 1, max: 7500 },
  Brand: { min: 1, max: 50 },
  ColorName: { min: 1, max: 50 },
} as const satisfies AvitoCategorySchema["textLimits"];

export type SneakersTemplateOverrides = Pick<
  AvitoCategorySchema,
  "templateId" | "nodeName" | "goodsTypeValues" | "apparelTypeValues"
> & {
  /**
   * Для utility-обуви (спорт/рабочая/резиновая/домашняя): Avito-схема не
   * требует Color/ColorName. Влияет ТОЛЬКО на `requiredFields` (drift-чек со
   * snapshot'ом). XML-output формattера и валидация Color/ColorName на стороне
   * `AvitoFormatter.buildAd` остаются прежними — Avito принимает наш sneakers-
   * XML для этих template'ов без претензий (эмпирически проверено).
   */
  utilityShoes?: boolean;
};

/**
 * Собирает `AvitoCategorySchema` для sneakers-template'а: per-template поля
 * передаются в `overrides`, всё остальное берётся из общих констант.
 */
export function buildSneakersSchema(
  overrides: SneakersTemplateOverrides,
): AvitoCategorySchema {
  const { utilityShoes, ...rest } = overrides;
  return {
    ...rest,
    requiredFields: utilityShoes
      ? UTILITY_SHOES_REQUIRED_FIELDS
      : SNEAKERS_REQUIRED_FIELDS,
    colorValues: SNEAKERS_COLOR_VALUES,
    conditionValues: SNEAKERS_CONDITION_VALUES,
    adTypeValues: SNEAKERS_AD_TYPE_VALUES,
    targetAudienceValues: SNEAKERS_TARGET_AUDIENCE_VALUES,
    paramTags: SNEAKERS_PARAM_TAGS,
    textLimits: SNEAKERS_TEXT_LIMITS,
  };
}
