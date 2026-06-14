/** Percent-коды разделителей, которыми склеивается список URL. */
const DELIMITER_PERCENT: Readonly<Record<string, string>> = {
  ",": "%2C",
  "|": "%7C",
  "\t": "%09",
  " ": "%20",
};

/**
 * Готовит URL к вставке элементом в список, который склеивается через
 * `delimiter`. Кодируем во всём URL только сам символ-разделитель (RFC 3986:
 * reserved-символ кодируется, когда конфликтует со своей разделяющей ролью) —
 * структуру URL не трогаем. Валидный URL заодно нормализуется через WHATWG
 * `URL`: идемпотентно, без двойного кодирования и без раскодирования готовых
 * `%XX`. Невалидный/относительный URL не теряем.
 *
 * Кодировка обязана совпадать с тем, чем consumer делает `join(delimiter)`.
 */
export function escapeUrlForList(rawUrl: string, delimiter = ","): string {
  const encoded = DELIMITER_PERCENT[delimiter] ?? encodeURIComponent(delimiter);
  let url = rawUrl;
  try {
    url = new URL(rawUrl).toString();
  } catch {
    // Невалидный/относительный URL — нормализовать нечем, экранируем как есть.
  }
  return url.replaceAll(delimiter, encoded);
}
