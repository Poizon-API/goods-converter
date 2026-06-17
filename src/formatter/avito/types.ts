import { type Product } from "../../types";
import { type AvitoProductError } from "./shared";

/**
 * Avito autoload template'ы, которые сейчас поддерживает библиотека.
 * Каждое значение соответствует файлу `templates/<id>.ts` и snapshot'у
 * `schemas/snapshots/avito-schema-<id>.json`. Чтобы добавить новый template:
 *
 *   1. `pnpm schema:fetch` (после правки `TEMPLATE_IDS` в скрипте).
 *   2. Создать `templates/<id>.ts` со схемой.
 *   3. Прописать в `templates/index.ts` (TEMPLATE_REGISTRY).
 *   4. Расширить union ниже.
 */
export type SupportedTemplateId =
  | 100368
  | 100369
  | 100370
  | 100371
  | 100372
  | 100373
  | 100374
  | 100375
  | 100376
  | 100377
  | 100378
  | 100379
  | 100380
  | 100381
  | 100383
  | 100384
  | 100385
  | 100386
  | 100387
  | 100388
  | 100389
  | 100390
  | 100391
  | 100392
  | 100393
  | 100394
  | 100395
  | 100396
  | 100397
  | 100398
  | 100399;

/**
 * Что делать с текстовым полем, длина которого превышает `schema.textLimits`:
 *   - `"truncate"` — обрезать по последней границе слова (fallback: грубо
 *     `slice(0, max)`, если первое слово длиннее лимита). Товар идёт в фид.
 *   - `"skip"` (default) — добавить `too_long` в `errors[]`; товар выпадает
 *     из фида и репортится через `onProductError`. Совместимо с `failOnError`.
 *   - `"fail"` — немедленный throw из `format(...)`. Жёсткий режим для CI/CD:
 *     лучше упасть всем экспортом, чем уронить произвольный товар. Не зависит
 *     от глобального `failOnError`.
 *
 * Runtime-tuple `AVITO_TEXT_OVERFLOW_VALUES` — для downstream-валидаторов
 * (zod/class-validator), которым нужен массив литералов; тип производный.
 */
export const AVITO_TEXT_OVERFLOW_VALUES = ["truncate", "skip", "fail"] as const;
export type AvitoTextOverflowPolicy =
  (typeof AVITO_TEXT_OVERFLOW_VALUES)[number];

/**
 * Category-level Avito-теги для ОДНОГО объявления: то, что в autoload-XML
 * пишется в `<Category>/<GoodsType>/<Condition>/<AdType>/<ApparelType>` (и
 * опционально `<TargetAudience>/<Address>`). Эти значения определяют, в какую
 * категорию Avito попадёт `<Ad>` — и в single-, и в multi-template режиме.
 *
 * `templateId` выбирает набор enum'ов/required-полей (`TEMPLATE_REGISTRY`),
 * против которого валидируются эти значения и per-product поля
 * (Color/ColorName/Size). Required-поля должны быть переданы caller'ом —
 * форматтер сам ничего не угадывает.
 */
export interface AvitoAdClassification {
  /**
   * Avito autoload template ID. Определяет какой набор enum'ов и required-
   * полей будет применён. См. `SupportedTemplateId`.
   */
  templateId: SupportedTemplateId;
  /** Категория в таксономии Avito, например "Одежда, обувь, аксессуары". */
  category: string;
  /** Тип товара. Из `SCHEMA.goodsTypeValues` template'а (см. templateId). */
  goodsType: string;
  /** Состояние товара. Из `SCHEMA.conditionValues`. */
  condition: string;
  /** Тип объявления. Из `SCHEMA.adTypeValues` (внимание: NBSP в значениях!). */
  adType: string;
  /** Вид обуви. Из `SCHEMA.apparelTypeValues` template'а. */
  apparelType: string;
  /** Целевая аудитория (тип покупателя). Опционально. */
  targetAudience?: string;
  /**
   * Адрес объекта (тег `<Address>`). Avito-валидатор требует Address в фиде,
   * хотя при реальной автозагрузке через кабинет адрес может подставляться из
   * настроек кабинета. Для прохождения standalone-валидации
   * (`autoload.avito.ru/format/xmlcheck/`) и для cases, где кабинетный адрес
   * не задан, поле обязательно передавать здесь. Если undefined — тег не
   * пишется (старое поведение).
   */
  address?: string;
}

interface AvitoSharedFormatterOptions {
  /**
   * Если true — на первом же невалидном товаре `format(...)` уничтожает
   * stream через `destroy(err)` и бросает ту же ошибку (consumer pipe
   * получит 'error', а не корректное закрытие partial-feed'а). По умолчанию
   * false: невалидные товары пропускаются и репортятся через `onProductError`.
   */
  failOnError?: boolean;
  /** Default: `"skip"`. См. `AvitoTextOverflowPolicy`. */
  titleOverflowPolicy?: AvitoTextOverflowPolicy;
  /** Default: `"skip"`. См. `AvitoTextOverflowPolicy`. */
  descriptionOverflowPolicy?: AvitoTextOverflowPolicy;
  /** Callback на каждый невалидный товар. */
  onProductError?: (event: AvitoProductError) => void;
}

/**
 * Single-template режим (back-compat): одна классификация применяется ко ВСЕМ
 * товарам выгрузки. Enum'ы валидируются один раз upfront — невалидная опция
 * роняет `format(...)` целиком (вся выборка делит одну классификацию, значит
 * ошибка в ней — это мисконфигурация всего фида, fail-fast уместен).
 *
 * Если когда-нибудь добавится принципиально другая категория (украшения с
 * Insert/Metal, мебель с Width/Height/Depth) — у неё будет свой Options-тип.
 */
export interface AvitoSingleTemplateOptions
  extends AvitoAdClassification,
    AvitoSharedFormatterOptions {
  /** Дискриминант union'а: в single-режиме резолвера нет. */
  resolveProduct?: undefined;
}

/**
 * Per-product часть классификации — единственное, что резолвер решает на каждый
 * товар, потому что у товаров оно РАЗЛИЧАЕТСЯ:
 *   - `templateId` — leaf-шаблон товара (из него форматтер выводит goodsType,
 *     apparelType и словарь размеров);
 *   - `condition` — состояние конкретного товара (новое/б-у может отличаться от
 *     товара к товару).
 * Общие для всего фида теги (`category`/`adType`/`targetAudience`/`address`)
 * задаются один раз в `AvitoMultiTemplateOptions`, не здесь.
 */
export interface AvitoProductClassification {
  templateId: SupportedTemplateId;
  condition: string;
}

/**
 * Multi-template режим: на каждый товар резолвер возвращает только различающуюся
 * часть (`templateId` + `condition`), а форматтер выводит `goodsType`/
 * `apparelType` из шаблона и склеивает с общими для фида тегами ниже. Позволяет
 * смешивать в одном `<Ads>`-фиде объявления разных шаблонов/полов (мужская +
 * женская обувь, разные виды) — формат autoload это допускает: каждый `<Ad>`
 * несёт свои category-level теги.
 *
 * `null` из резолвера = «для товара нет поддерживаемого шаблона» → товар
 * пропускается с ошибкой через `onProductError`, не роняя весь фид.
 */
export interface AvitoMultiTemplateOptions extends AvitoSharedFormatterOptions {
  resolveProduct: (product: Product) => AvitoProductClassification | null;
  /** Корень `<Category>`, общий для всех `<Ad>` (например "Одежда, обувь, аксессуары"). */
  category: string;
  /** `<AdType>`, общий для фида (внимание: NBSP в значениях справочника). */
  adType: string;
  /** `<TargetAudience>`, общий для фида. */
  targetAudience?: string;
  /** `<Address>`, общий для фида. */
  address?: string;
  // `?: never` запрещает в multi-режиме поля, которые либо выводит форматтер
  // (goodsType/apparelType), либо возвращает резолвер (templateId/condition) —
  // и делает режимы взаимоисключающими даже для переменных, не только литералов.
  templateId?: never;
  goodsType?: never;
  apparelType?: never;
  condition?: never;
}

/**
 * Опции форматтера для категорий типа «sneakers» в Avito (обувь, кеды,
 * кроссовки, слипоны — все template'ы со схемой Brand/ColorName/Size/
 * GoodsType/ApparelType/Condition/AdType).
 *
 * Discriminated union по `resolveProduct`:
 *   - без `resolveProduct` — single-template (классификация в самих опциях);
 *   - с `resolveProduct` — multi-template (классификация per-product).
 * Передать и то и другое одновременно нельзя — это ошибка типов.
 */
export type AvitoSneakersFormatterOptions =
  | AvitoSingleTemplateOptions
  | AvitoMultiTemplateOptions;
