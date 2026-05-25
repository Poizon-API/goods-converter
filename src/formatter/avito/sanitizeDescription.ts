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
const AVITO_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
] as const;

/**
 * Очищает HTML в описании Avito-объявления до allowlist'а из spec'а.
 *
 * Поведение:
 *  - Запрещённые теги стрипаются (`<div>x</div>` → `x`), inner-text сохраняется.
 *  - Атрибуты у разрешённых тегов вырезаются (`<p class="x">y</p>` → `<p>y</p>`).
 *  - `<b>` → `<strong>`, `<i>` → `<em>` — синонимы, которые Avito иначе
 *    стрипает с потерей форматирования. `<u>` стрипается (нет аналога).
 *  - `<br>` нормализуется в `<br />` (`selfClosing`).
 *
 * `\n` НЕ конвертится в `<br/>`: Avito делает это сам внутри CDATA
 * (см. spec: «Тег n преобразуется в br»), двойная конверсия раздула бы
 * интервалы.
 *
 * Длина результата может быть меньше входной (после strip'а) или больше
 * (если в тексте есть `<`, `&` — sanitize-html их экранирует в entity:
 * `&lt;`, `&amp;`). Поэтому вызывать ДО `applyOverflowPolicy`, чтобы
 * length-валидация считала именно ту строку, которая попадёт в фид.
 */
export function sanitizeAvitoDescription(value: string): string {
  if (!value) return value;
  return sanitizeHtml(value, {
    allowedTags: [...AVITO_ALLOWED_TAGS],
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: "discard",
    selfClosing: ["br"],
    transformTags: {
      b: sanitizeHtml.simpleTransform("strong", {}),
      i: sanitizeHtml.simpleTransform("em", {}),
    },
  });
}
