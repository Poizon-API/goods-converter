import { type Product } from "../../types";

/**
 * Сортировка вариантов в описании.
 *   - `"value-numeric-asc"` (default) — пытается распарсить значения как числа
 *     (`"36"` → 36, `"36,5"` → 36.5) и сортировать по возрастанию. Если хоть
 *     одно значение группы не числовое — fallback на locale-aware ASC.
 *   - `"value-asc"` — всегда locale-aware ASC по строке.
 *   - `"price-asc"` — по цене вариант ASC (на случай если param — это, к
 *     примеру, не размер, а условный «комплектация», для которого порядок
 *     по цене информативнее).
 */
export type CollapseVariantsSort =
  | "value-numeric-asc"
  | "value-asc"
  | "price-asc";

export interface CollapseAvitoVariantsOptions {
  /**
   * Имя ключа в `product.params` (а если там нет — в `product.properties`), по
   * которому строится таблица вариантов. **Generic**: это может быть `"Size"`,
   * `"Color"`, `"Объём"`, или любой другой param. Совпадение case-sensitive,
   * как и в `AvitoFormatter.buildParamIndex`.
   */
  paramKey: string;
  /**
   * Заголовок таблицы. Default: `"Варианты и цены:"`.
   */
  headerText?: string;
  /**
   * Префикс к цене в строке (например, `"от "`). Default: пусто.
   */
  pricePrefix?: string;
  /**
   * Суффикс к цене. Default: `" ₽"`.
   */
  priceSuffix?: string;
  /**
   * Разделитель между исходным description и таблицей. Default: `"<br><br>"`.
   * sanitize-html (см. `sanitizeAvitoDescription`) пропускает `<br>`.
   */
  separator?: string;
  /** Default: `"value-numeric-asc"`. См. `CollapseVariantsSort`. */
  sort?: CollapseVariantsSort;
}

/**
 * Сворачивает варианты одного товара (`Product[]` с общим `productId`) в одно
 * объявление с минимальной положительной ценой и таблицей вариантов в
 * описании. Используется когда Avito-фид должен показывать один `<Ad>` на
 * товар (а не на каждую SKU), а размер/цвет/объём — в описании.
 *
 * **Что делается на группу** (= товары с одним `productId`):
 *   1. Выбирается представитель с минимальной положительной ценой (нулевые/
 *      отрицательные/NaN не участвуют — повторяем семантику
 *      `dedupeGoatSkusByMinPrice`).
 *   2. Собирается список `{value: params[paramKey], price}` для каждого
 *      варианта группы; варианты без `paramKey` пропускаются.
 *   3. Список сортируется по `options.sort`.
 *   4. К `description` представителя дописывается HTML-таблица:
 *      `<p><strong>Header</strong></p><ul><li>paramKey value — price ₽</li>…</ul>`.
 *      Только теги из Avito-allowlist (`p`/`strong`/`ul`/`li`/`br`); описание
 *      потом ещё пройдёт через `sanitizeAvitoDescription` в `AvitoFormatter`.
 *   5. В результат идёт только представитель.
 *
 * **Edge-cases**:
 *   - Группа из 1 элемента → представитель возвращается как есть, без HTML-
 *     аппенда (одиночному товару таблица не нужна).
 *   - Ни у одного варианта группы нет `paramKey` → группа НЕ сворачивается:
 *     все элементы возвращаются как есть. Это safety: без значения param'а
 *     таблица бессмысленна, плюс сохраняем старое поведение (N ad'ов) если
 *     юзер ошибся именем ключа.
 *   - Все цены в группе невалидны (≤0 / NaN / Infinity) → возвращается
 *     первый встретившийся элемент (нет «лучшего») с таблицей. Формaттер
 *     потом отбракует его по `out_of_range` — но это лучше, чем тихо
 *     выбросить весь товар.
 *   - Внутри группы порядок `productId` сохраняется (стабильный): представитель
 *     возвращается в той позиции, где он впервые встретился в input'е.
 *
 * Чистая функция: input не мутируется, на каждого представителя клонируется
 * новый объект.
 */
export function collapseAvitoVariantsByParam(
  products: Product[],
  options: CollapseAvitoVariantsOptions,
): Product[] {
  const {
    paramKey,
    headerText = "Варианты и цены:",
    pricePrefix = "",
    priceSuffix = " ₽",
    separator = "<br><br>",
    sort = "value-numeric-asc",
  } = options;

  // Группировка с сохранением порядка первого появления group-key — Map в JS
  // гарантирует insertion-order при iter(). Это важно: представитель должен
  // попасть в output на ту же логическую позицию, где был любой из вариантов
  // его группы (consumer'ы зависят от стабильности порядка фида).
  const groups = new Map<number, Product[]>();
  for (const product of products) {
    const existing = groups.get(product.productId);
    if (existing) existing.push(product);
    else groups.set(product.productId, [product]);
  }

  const result: Product[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Safety: если ни у одного варианта нет paramKey — schrumpfung не имеет
    // смысла, оставляем всё как есть. Иначе всю группу схлопнули бы в один
    // ad с пустым описанием вариантов и потеряли информацию.
    const haveAnyParam = group.some(
      (p) => readParam(p, paramKey).length > 0,
    );
    if (!haveAnyParam) {
      result.push(...group);
      continue;
    }

    const representative = pickMinPriceRepresentative(group);

    const rows = buildVariantRows(group, paramKey, sort);

    const appendix = renderVariantTable(
      rows,
      paramKey,
      headerText,
      pricePrefix,
      priceSuffix,
    );

    const trimmedDescription = (representative.description ?? "").trim();
    const description =
      trimmedDescription.length > 0
        ? trimmedDescription + separator + appendix
        : appendix;

    result.push({ ...representative, description });
  }

  return result;
}

interface VariantRow {
  value: string;
  price: number;
  /** Pre-parsed numeric, NaN если value не парсится — для numeric-сортировки. */
  numeric: number;
}

function buildVariantRows(
  group: Product[],
  paramKey: string,
  sort: CollapseVariantsSort,
): VariantRow[] {
  const rows: VariantRow[] = [];
  for (const product of group) {
    const value = readParam(product, paramKey);
    if (value.length === 0) continue;
    rows.push({
      value,
      price: product.price,
      numeric: parseLocaleNumber(value),
    });
  }
  return sortVariantRows(rows, sort);
}

function sortVariantRows(
  rows: VariantRow[],
  sort: CollapseVariantsSort,
): VariantRow[] {
  if (sort === "price-asc") {
    return [...rows].sort((a, b) => a.price - b.price);
  }
  const allNumeric =
    sort === "value-numeric-asc" && rows.every((r) => Number.isFinite(r.numeric));
  if (allNumeric) {
    return [...rows].sort((a, b) => a.numeric - b.numeric);
  }
  return [...rows].sort((a, b) =>
    a.value.localeCompare(b.value, "ru", { numeric: true }),
  );
}

/**
 * Среди вариантов выбирается тот, у кого минимальная **положительная конечная**
 * цена. Не-real prices (NaN/Infinity/≤0) исключаются из соревнования.
 * Если real-prices нет вовсе — fallback на первый элемент группы (он же
 * потом будет отбракован формaттером по `out_of_range`, но это explicit
 * fallback вместо тихой потери товара).
 */
function pickMinPriceRepresentative(group: Product[]): Product {
  let best: Product | undefined;
  for (const candidate of group) {
    if (!isRealPrice(candidate.price)) continue;
    if (best === undefined || candidate.price < best.price) {
      best = candidate;
    }
  }
  return best ?? group[0];
}

function isRealPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Парсит число с десятичной запятой/точкой (Avito хранит размеры как `"36,5"`).
 * Для всего, что не число (`"42 EU"`, `"M"`, …) → NaN, что выключает numeric-
 * sort и заставляет fallback на locale-aware string sort.
 */
function parseLocaleNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (normalized.length === 0) return NaN;
  // parseFloat распарсит "36abc" → 36, что для нас false-positive (numeric-
  // sort включится, а значения будут смешанные). Поэтому проверяем что
  // строка целиком — число.
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

/**
 * Зеркалит `AvitoFormatter.buildParamIndex` semantics: ищет ключ сначала в
 * `params`, при отсутствии (или пустом значении) — в `properties`. Empty/
 * whitespace трактуется как «не задано». Важно: ключ — exact-match case-
 * sensitive, как делает индекс в формaттере.
 */
function readParam(product: Product, key: string): string {
  const lists = [product.params, product.properties];
  for (const list of lists) {
    if (!list) continue;
    for (const param of list) {
      if (typeof param?.key !== "string") continue;
      if (typeof param?.value !== "string") continue;
      if (param.key !== key) continue;
      const trimmed = param.value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return "";
}

/**
 * Цена форматируется с разделителем тысяч ` ` (NBSP) — стандарт для
 * русской типографики, который Avito-CDATA принимает как обычный символ. Дробная
 * часть округляется до целого (Avito не разрешает дробные `<Price>`).
 */
function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const integer = Math.round(value);
  return integer.toLocaleString("ru-RU").replace(/\s/g, " ");
}

function renderVariantTable(
  rows: VariantRow[],
  paramKey: string,
  headerText: string,
  pricePrefix: string,
  priceSuffix: string,
): string {
  // HTML-entity-escape: paramKey/headerText/value/prefix/suffix приходят от
  // пользователя (DTO) или из feed'а — могут содержать `<`/`>`/`&`. Внутри
  // `<li>` это бы поломало парсер на стороне Avito (плюс sanitize-html сам
  // эскейпит, но мы хотим, чтобы тут уже была валидная разметка).
  const escapedHeader = escapeHtml(headerText);
  const escapedKey = escapeHtml(paramKey);
  const items = rows
    .map(
      (row) =>
        `<li>${escapedKey} ${escapeHtml(row.value)} — ` +
        `${escapeHtml(pricePrefix)}${formatPrice(row.price)}${escapeHtml(priceSuffix)}</li>`,
    )
    .join("");
  return `<p><strong>${escapedHeader}</strong></p><ul>${items}</ul>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
