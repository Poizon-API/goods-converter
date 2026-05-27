import { type Product } from "../../types";

export interface CollapseAvitoVariantsOptions {
  /** Case-sensitive, как `AvitoFormatter.buildParamIndex`. */
  paramKey: string;
}

/**
 * Сворачивает варианты одного товара (общий `productId`) в один представитель
 * с минимальной положительной ценой среди вариантов, у которых задан
 * `paramKey`. Описание представителя НЕ модифицируется — форматирование
 * списка вариантов остаётся на стороне consumer'а (например, через
 * descriptionTemplate в export-api).
 *
 * Чистая функция: input не мутируется. Порядок групп в output совпадает с
 * порядком первого появления `productId` в input — нужен стабильный порядок
 * для diff-able re-uploads фида.
 *
 * Если ни у одного варианта группы нет `paramKey` (опечатка в имени, нет
 * данных) — группа возвращается as-is, без свёртки. Safer fallback, чем
 * схлопнуть всё в один ad по случайной цене.
 */
export function collapseAvitoVariantsByParam(
  products: Product[],
  options: CollapseAvitoVariantsOptions,
): Product[] {
  const { paramKey } = options;

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
    result.push(pickMinPriceRepresentative(paramBearers));
  }

  return result;
}

function collectParamBearers(group: Product[], paramKey: string): Product[] {
  const bearers: Product[] = [];
  for (const product of group) {
    if (readParam(product, paramKey).length === 0) continue;
    bearers.push(product);
  }
  return bearers;
}

function pickMinPriceRepresentative(bearers: Product[]): Product {
  let best: Product | undefined;
  for (const candidate of bearers) {
    if (!isRealPrice(candidate.price)) continue;
    if (best === undefined || candidate.price < best.price) {
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
