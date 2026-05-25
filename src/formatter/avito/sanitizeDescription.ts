import sanitizeHtml from "sanitize-html";

/**
 * Allowlist HTML-тегов в `<Description>` из Avito autoload-доки
 * (snapshot.groups[*].fields[Description].description, актуально для всех
 * наших template'ов 100368-100399 и подтверждено независимо для категорий
 * «Работа», ABCP, Elama):
 *
 *   «Использовать можно только HTML-теги из списка: p, br, strong, em, ul, ol, li».
 *
 * Любые остальные теги (`<div>`, `<span>`, `<a>`, `<img>`, `<h1>-<h6>`,
 * `<script>`, …) Avito молча вырезает на этапе модерации согласно правилу
 * «технической адаптации» (avito.ru/legal/rules/listings/items-quality:
 * «вправе … технически адаптировать часть [объявления], нарушающую
 * отдельные правила»). Валидатор autoload.avito.ru/format/xmlcheck/ HTML
 * НЕ проверяет, поэтому полагаться на upstream-стрип нельзя — фид может
 * выглядеть валидным, но опубликоваться без форматирования.
 */
const AVITO_DESCRIPTION_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
] as const;

/**
 * Опции для sanitize-html: создаются ОДИН РАЗ на module load.
 *
 * `<b>` → `<strong>`, `<i>` → `<em>` — синонимы, которые Avito иначе бы
 * стрипал с потерей форматирования. `shouldMerge=false` явно фиксирует
 * intent: исходные атрибуты в новый тег НЕ переносятся (default sanitize-
 * html — `true`; тут не критично из-за `allowedAttributes: {}`, но защита
 * от регресса при будущем расширении allowedAttributes).
 *
 * `allowedSchemes: []` — defense-in-depth на случай добавления `<a>` в
 * allowlist (для `href`/`src`); в текущей конфигурации no-op.
 */
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [...AVITO_DESCRIPTION_ALLOWED_TAGS],
  allowedAttributes: {},
  allowedSchemes: [],
  disallowedTagsMode: "discard",
  transformTags: {
    b: sanitizeHtml.simpleTransform("strong", {}, false),
    i: sanitizeHtml.simpleTransform("em", {}, false),
  },
};

/**
 * Очищает HTML в `<Description>` до Avito-allowlist (см. JSDoc выше).
 *
 * `\n` НЕ конвертится в `<br/>`: Avito делает это сам внутри CDATA (spec:
 * «Тег n преобразуется в br»), двойная конверсия раздула бы интервалы.
 *
 * Длина результата может уменьшиться (strip запрещённых тегов) или
 * вырасти (entity-escape `<`, `&` в text-node), поэтому вызывать ДО
 * `applyOverflowPolicy` — length-валидация должна считать итоговую
 * строку, которая попадёт в фид.
 */
export function sanitizeAvitoDescription(value: string): string {
  if (!value) return "";
  // Fast-path для plain-text без HTML-маркеров — ~19× быстрее, чем full
  // parse через htmlparser2 (важно для GOAT-адаптера и подобных, что
  // отдают чистый текст). Корректность: sanitize-html в text-node
  // эскейпит ВСЕ три специальных HTML-символа (`<` → `&lt;`, `>` → `&gt;`,
  // `&` → `&amp;`). Если ни одного из них нет — output == input.
  if (!/[<&>]/.test(value)) return value;
  return sanitizeHtml(value, SANITIZE_OPTS);
}

/**
 * Снимает с конца строки оборванный HTML-тег или entity, которые могли
 * остаться после `applyOverflowPolicy.truncate` (slice по symbols без
 * понимания HTML). На стороне Avito CDATA-content декодится как HTML;
 * HTML5-парсер по `eof-in-tag` игнорирует оборванный тег, а по
 * `missing-semicolon-after-character-reference` рендерит оборванный
 * entity литерально (`&am` показывается как `&am`, а не `&`).
 *
 * Регекспы:
 *  1. Trailing partial-tag: `<` или `</` + ASCII alpha + любые символы,
 *     не содержащие `<>` (т.е. незакрытый start/end-tag в конце).
 *  2. Trailing partial-entity: `&` + опц. `#`/`#x` + 1+ alnum БЕЗ `;`.
 *     Lone `&` оставляем — HTML5 рендерит его как литерал `&`.
 *
 * Для plain-text без `<`/`&`-хвостов — no-op.
 */
export function clampPartialHtml(value: string): string {
  if (!value) return value;
  return value
    .replace(/<\/?[a-zA-Z][^<>]*$/, "")
    .replace(/&(?:#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*)$/, "");
}
