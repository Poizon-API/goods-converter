import { type Product } from "../../types";

/**
 * `value-numeric-asc` (default): numeric ASC, fallback на locale-aware при
 * любом non-numeric значении в группе.
 * `value-asc`: plain locale ASC, без numeric-coercion.
 * `price-asc`: ASC по цене.
 */
export type CollapseVariantsSort =
  | "value-numeric-asc"
  | "value-asc"
  | "price-asc";

export interface CollapseAvitoVariantsOptions {
  /** Case-sensitive, как `AvitoFormatter.buildParamIndex`. */
  paramKey: string;
  headerText?: string;
  pricePrefix?: string;
  priceSuffix?: string;
  /** Между исходным description и таблицей. `<br>` проходит sanitizeAvitoDescription. */
  separator?: string;
  sort?: CollapseVariantsSort;
}

/**
 * Сворачивает варианты одного товара (общий `productId`) в одно объявление
 * с минимальной положительной ценой; описание дополняется HTML-таблицей
 * `<paramKey value → price>`.
 *
 * Чистая функция: input не мутируется. Порядок групп в output совпадает с
 * порядком первого появления `productId` в input — фиду нужен стабильный
 * порядок для diff-able re-uploads.
 *
 * Если ни у одного варианта группы нет `paramKey` (опечатка в имени? нет
 * данных?) — группа возвращается as-is, без свёртки. Это safer fallback,
 * чем схлопнуть всё в один ad без списка вариантов.
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

  // Map гарантирует insertion-order при iter() — представитель попадает в
  // позицию первой встречи группы. Замена на Record/Object порядок ломает.
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
    const paramBearers = collectParamBearers(group, paramKey);
    if (paramBearers.length === 0) {
      result.push(...group);
      continue;
    }

    // Min-price только среди bearers: цена представителя обязана совпадать
    // с одной из строк таблицы, иначе покупатель увидит цену, не отражённую
    // ни в одном варианте.
    const representative = pickMinPriceRepresentative(paramBearers);
    const rows = buildVariantRows(paramBearers, sort);
    const appendix = renderVariantTable(
      rows,
      paramKey,
      headerText,
      pricePrefix,
      priceSuffix,
    );

    const trimmedDescription = (representative.product.description ?? "").trim();
    const description =
      trimmedDescription.length > 0
        ? trimmedDescription + separator + appendix
        : appendix;

    result.push({ ...representative.product, description });
  }

  return result;
}

interface ParamBearer {
  product: Product;
  value: string;
}

function collectParamBearers(
  group: Product[],
  paramKey: string,
): ParamBearer[] {
  const bearers: ParamBearer[] = [];
  for (const product of group) {
    const value = readParam(product, paramKey);
    if (value.length === 0) continue;
    bearers.push({ product, value });
  }
  return bearers;
}

interface VariantRow {
  value: string;
  price: number;
  /** NaN sentinel = value не парсится; выключает numeric-sort. */
  numeric: number;
}

function buildVariantRows(
  bearers: ParamBearer[],
  sort: CollapseVariantsSort,
): VariantRow[] {
  const rows: VariantRow[] = bearers.map((bearer) => ({
    value: bearer.value,
    price: bearer.product.price,
    numeric: parseLocaleNumber(bearer.value),
  }));
  sortVariantRows(rows, sort);
  return rows;
}

function sortVariantRows(rows: VariantRow[], sort: CollapseVariantsSort): void {
  if (sort === "price-asc") {
    rows.sort((a, b) => a.price - b.price);
    return;
  }
  if (sort === "value-asc") {
    rows.sort((a, b) => a.value.localeCompare(b.value, "ru"));
    return;
  }
  const allNumeric = rows.every((r) => Number.isFinite(r.numeric));
  if (allNumeric) {
    rows.sort((a, b) => a.numeric - b.numeric);
    return;
  }
  rows.sort((a, b) =>
    a.value.localeCompare(b.value, "ru", { numeric: true }),
  );
}

function pickMinPriceRepresentative(bearers: ParamBearer[]): ParamBearer {
  let best: ParamBearer | undefined;
  for (const candidate of bearers) {
    if (!isRealPrice(candidate.product.price)) continue;
    if (best === undefined || candidate.product.price < best.product.price) {
      best = candidate;
    }
  }
  // Все цены невалидны → отдаём первый bearer; формaттер отбракует его по
  // out_of_range. Лучше явный fallback, чем тихая потеря товара.
  return best ?? bearers[0];
}

function isRealPrice(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function parseLocaleNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (normalized.length === 0) return NaN;
  // parseFloat распарсил бы "36abc" → 36 — false-positive: numeric-sort
  // включился бы на смешанной группе. Требуем строку целиком как число.
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

/** Зеркало `AvitoFormatter.buildParamIndex`: params → properties, exact-match. */
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

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const integer = Math.round(value);
  // toLocaleString отдаёт NBSP/narrow-NBSP (зависит от версии ICU); ASCII-
  // пробел для детерминизма в diff-able output'е.
  return integer.toLocaleString("ru-RU").replace(/\s/g, " ");
}

function renderVariantTable(
  rows: VariantRow[],
  paramKey: string,
  headerText: string,
  pricePrefix: string,
  priceSuffix: string,
): string {
  // User-controlled values из DTO/feed'а — escape'им, чтобы не пропустить
  // мусорные теги мимо sanitize-html в формaттере.
  const escapedHeader = escapeHtml(headerText);
  const escapedKey = escapeHtml(paramKey);
  const escapedPrefix = escapeHtml(pricePrefix);
  const escapedSuffix = escapeHtml(priceSuffix);
  const items = rows
    .map(
      (row) =>
        `<li>${escapedKey} ${escapeHtml(row.value)} — ` +
        `${escapedPrefix}${formatPrice(row.price)}${escapedSuffix}</li>`,
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
