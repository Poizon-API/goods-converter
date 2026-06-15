import { expect, describe, it } from "vitest";

import { parseCsv } from "./utils/parseCsv";

// parseCsv — общий oracle round-trip-проверок (CSVEscaping и escapeCategoryName).
// Прямые тесты нужны, чтобы баг в самом парсере не давал ложно-зелёных проверок
// в зависящих от него suite.
describe("parseCsv", () => {
  it("разбирает одну строку без завершающего перевода строки", () => {
    expect(parseCsv("a;b;c", ";")).toEqual([["a", "b", "c"]]);
  });

  it("разбивает на строки по `\\n` и не плодит пустую строку в конце", () => {
    expect(parseCsv("a;b\nc;d\n", ";")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("параметризуется разделителем (tab)", () => {
    expect(parseCsv("a\tb\tc", "\t")).toEqual([["a", "b", "c"]]);
  });

  it("сохраняет разделитель внутри quoted-поля", () => {
    expect(parseCsv('a;"b;c";d', ";")).toEqual([["a", "b;c", "d"]]);
  });

  it("сохраняет перенос строки внутри quoted-поля (не рвёт запись)", () => {
    expect(parseCsv('a;"строка1\nстрока2"', ";")).toEqual([
      ["a", "строка1\nстрока2"],
    ]);
  });

  it('раскрывает удвоенную кавычку `""` в одну `"`', () => {
    expect(parseCsv('"он сказал ""привет"""', ";")).toEqual([
      ['он сказал "привет"'],
    ]);
  });

  it("сохраняет пустые поля", () => {
    expect(parseCsv("a;;c", ";")).toEqual([["a", "", "c"]]);
  });

  it("игнорирует `\\r` (CRLF не оставляет хвостов в значениях)", () => {
    expect(parseCsv("a;b\r\nc;d", ";")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("round-trip: поле с разделителем, кавычкой и переносом восстанавливается дословно", () => {
    const field = 'есть ; и "кавычка"\nи перенос';
    // Так это поле выглядит после RFC4180-квотинга (кавычки удвоены, всё в "").
    const quoted = `x;"${field.replace(/"/g, '""')}"`;
    expect(parseCsv(quoted, ";")).toEqual([["x", field]]);
  });

  it("пустой ввод даёт пустой результат", () => {
    expect(parseCsv("", ";")).toEqual([]);
  });
});
