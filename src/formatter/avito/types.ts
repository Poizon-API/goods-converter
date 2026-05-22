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
 * Опции форматтера для категорий типа «sneakers» в Avito (обувь, кеды,
 * кроссовки, слипоны — все template'ы со схемой Brand/ColorName/Size/
 * GoodsType/ApparelType/Condition/AdType). Если когда-нибудь добавится
 * принципиально другая категория (украшения с Insert/Metal, мебель с
 * Width/Height/Depth) — у неё будет свой Options-тип.
 *
 * Required-поля schemы template'а должны быть переданы caller'ом — форматтер
 * сам ничего не угадывает. Невалидный товар не попадёт в XML, репортится
 * через `onProductError`.
 */
export interface AvitoSneakersFormatterOptions {
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
