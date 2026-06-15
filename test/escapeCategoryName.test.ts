import { Formatters } from "src";
import { escapeCategoryName } from "src/utils/escapeCategoryName";
import { expect, describe, it } from "vitest";

import { categories, products } from "./constants";
import { parseCsv } from "./utils/parseCsv";
import { streamToBuffer } from "./utils/streamToBuffer";

import { PassThrough } from "stream";

/**
 * Сериализация одного пути категории — ровно то, что делает
 * WooCommerce.formatter.ts на строке сборки колонки `Categories`:
 * каждое имя уровня экранируется, уровни склеиваются ` > `.
 */
const serializePath = (levelNames: string[]): string =>
  levelNames.map(escapeCategoryName).join(" > ");

// Симуляция импортёра WooCommerce: он режет значение `Categories` по запятым,
// НЕ предварённым бэкслешем, на отдельные категории; `\,` остаётся частью имени.
// Это модель документированного поведения импортёра — то самое разбиение по
// «голой» запятой, из-за которого и возник баг (woocommerce/woocommerce#16192).
const splitIntoCategories = (cell: string): string[] => cell.split(/(?<!\\),/);
const unescapeCategory = (cell: string): string => cell.replaceAll("\\,", ",");

describe("escapeCategoryName", () => {
  it("экранирует запятую внутри имени бэкслешем", () => {
    expect(escapeCategoryName("Джемперы, свитеры и кардиганы")).toBe(
      "Джемперы\\, свитеры и кардиганы",
    );
  });

  it("экранирует каждую запятую в имени с несколькими запятыми", () => {
    expect(escapeCategoryName("Кошельки, ключницы и визитницы")).toBe(
      "Кошельки\\, ключницы и визитницы",
    );
  });

  it("имя без запятой возвращает без изменений", () => {
    expect(escapeCategoryName("Брюки")).toBe("Брюки");
  });

  it("идемпотентна: уже экранированную `\\,` повторно не трогает (нет `\\\\,`)", () => {
    const once = escapeCategoryName("Угги, валенки и дутики");
    expect(escapeCategoryName(once)).toBe(once);
    expect(once).not.toContain("\\\\,");
  });

  it("идемпотентна на имени с НЕСКОЛЬКИМИ запятыми (каждая экранируется один раз)", () => {
    const once = escapeCategoryName("Кошельки, ключницы, визитницы");
    expect(once).toBe("Кошельки\\, ключницы\\, визитницы");
    expect(escapeCategoryName(once)).toBe(once);
    expect(once).not.toContain("\\\\,");
  });

  it("в частично экранированном имени трогает только неэкранированные запятые", () => {
    // Первая запятая уже `\,`, вторая — голая: lookbehind должен пропустить
    // первую и экранировать только вторую, без двойного экранирования.
    expect(escapeCategoryName("Кошельки\\, ключницы, визитницы")).toBe(
      "Кошельки\\, ключницы\\, визитницы",
    );
  });

  it("экранирует запятую без пробела (привязка к `,`, а не к `, `)", () => {
    expect(escapeCategoryName("Топы,футболки")).toBe("Топы\\,футболки");
  });

  it("экранирует запятую в начале и в конце имени (границы lookbehind)", () => {
    expect(escapeCategoryName(",спорное")).toBe("\\,спорное");
    expect(escapeCategoryName("спорное,")).toBe("спорное\\,");
  });

  it("пустую строку возвращает как есть", () => {
    expect(escapeCategoryName("")).toBe("");
  });
});

describe("сериализация пути Categories (`.map(escapeCategoryName).join(' > ')`)", () => {
  // Таблица из постановки: имя/путь → ожидаемое значение в CSV.
  it.each([
    [
      ["Одежда", "Джемперы, свитеры и кардиганы"],
      "Одежда > Джемперы\\, свитеры и кардиганы",
    ],
    [
      ["Аксессуары", "Кошельки, ключницы и визитницы"],
      "Аксессуары > Кошельки\\, ключницы и визитницы",
    ],
    [["Обувь", "Угги, валенки и дутики"], "Обувь > Угги\\, валенки и дутики"],
    [
      ["Обувь", "Пиджаки, жакеты и жилеты"],
      "Обувь > Пиджаки\\, жакеты и жилеты",
    ],
    [["Носки, колготки и чулки"], "Носки\\, колготки и чулки"],
    // Путь без запятых не меняется, ` > `-иерархия не трогается.
    [["Одежда", "Брюки"], "Одежда > Брюки"],
  ])("%j → %s", (levelNames, expected) => {
    expect(serializePath(levelNames)).toBe(expected);
  });

  it("пустой путь (нет уровней) сериализуется в пустую строку", () => {
    expect(serializePath([])).toBe("");
  });

  it("повторный прогон уже экранированного пути ничего не меняет", () => {
    const once = serializePath(["Одежда", "Джемперы, свитеры и кардиганы"]);
    // Эмулируем второй прогон: имена уровней уже содержат `\,`.
    const twice = once.split(" > ").map(escapeCategoryName).join(" > ");
    expect(twice).toBe(once);
    expect(twice).not.toContain("\\\\,");
  });

  it("WC-симуляция: одиночный путь импортёр видит как РОВНО одну категорию", () => {
    const cell = serializePath(["Одежда", "Джемперы, свитеры и кардиганы"]);
    const segments = splitIntoCategories(cell);
    expect(segments).toHaveLength(1);
    // Разэкранирование дословно возвращает исходный путь с именами как в базе.
    expect(unescapeCategory(segments[0])).toBe(
      "Одежда > Джемперы, свитеры и кардиганы",
    );
  });

  it("WC-симуляция: запятые-разделители МЕЖДУ категориями не экранируются", () => {
    // Две категории на товар: "A" и путь "C > D" — склеены неэкранированной ",".
    const cell = [serializePath(["A"]), serializePath(["C", "D"])].join(",");
    expect(cell).toBe("A,C > D");
    expect(splitIntoCategories(cell)).toEqual(["A", "C > D"]);
  });

  it("WC-симуляция: несколько категорий, и каждая С запятыми в имени → ровно столько сегментов, сколько категорий", () => {
    // Самый коварный случай: запятые-разделители между категориями и запятые
    // ВНУТРИ имён в одной ячейке. Импортёр должен увидеть ровно 2 категории.
    const a = ["Одежда", "Джемперы, свитеры и кардиганы"];
    const b = ["Аксессуары", "Кошельки, ключницы и визитницы"];
    const cell = [serializePath(a), serializePath(b)].join(",");

    const segments = splitIntoCategories(cell);
    expect(segments).toHaveLength(2);
    expect(unescapeCategory(segments[0])).toBe(
      "Одежда > Джемперы, свитеры и кардиганы",
    );
    expect(unescapeCategory(segments[1])).toBe(
      "Аксессуары > Кошельки, ключницы и визитницы",
    );
  });
});

describe("WooCommerceFormatter — интеграция (колонка Categories)", () => {
  // Фикстура categories содержит имя с запятой: «Одежда, обувь и аксессуары».
  // Путь товара categoryId=1: Все товары > Одежда, обувь и аксессуары > Обувь.
  const EXPECTED_PATH = "Все товары > Одежда, обувь и аксессуары > Обувь";

  const formatToCsv = async (): Promise<string> => {
    const stream = new PassThrough();
    await new Formatters.WooCommerceFormatter().format(
      stream,
      products,
      categories,
      undefined,
    );
    return (await streamToBuffer(stream)).toString();
  };

  it("Categories: импортёр видит РОВНО одну категорию, а путь восстанавливается round-trip", async () => {
    // WooCommerce CSV использует разделитель полей ';', поэтому запятая внутри
    // ячейки не вызывает RFC4180-квотинг — парсим тем же разделителем.
    const rows = parseCsv(await formatToCsv(), ";");
    const catIdx = rows[0].indexOf("Categories");
    expect(catIdx).toBeGreaterThanOrEqual(0);

    const cells = rows
      .slice(1)
      .map((row) => row[catIdx])
      .filter(Boolean);
    // У обоих товаров categoryId=1 → ячейка Categories есть и у parent, и у variation.
    expect(cells.length).toBeGreaterThan(0);

    for (const cell of cells) {
      expect(cell).toBe("Все товары > Одежда\\, обувь и аксессуары > Обувь");
      // Ровно одна категория: неэкранированных запятых в ячейке нет.
      expect(splitIntoCategories(cell)).toHaveLength(1);
      // Источник истины не искажён: разэкранирование возвращает имена из базы.
      expect(unescapeCategory(cell)).toBe(EXPECTED_PATH);
    }
  });

  it("Tags и Images: запятые-разделители списков НЕ экранируются (п.4 спеки)", async () => {
    const rows = parseCsv(await formatToCsv(), ";");
    const header = rows[0];
    const tagsIdx = header.indexOf("Tags");
    const imagesIdx = header.indexOf("Images");
    expect(tagsIdx).toBeGreaterThanOrEqual(0);
    expect(imagesIdx).toBeGreaterThanOrEqual(0);

    const dataRows = rows.slice(1);
    // Регрессионный инвариант: escapeCategoryName не должен трогать эти колонки.
    for (const row of dataRows) {
      expect(row[tagsIdx] ?? "").not.toContain("\\,");
      expect(row[imagesIdx] ?? "").not.toContain("\\,");
    }
    // Tags склеены сырой запятой-разделителем (keywords: ["Обувь","Кроссовки"]).
    // Берём только непустые ячейки, чтобы пустые Tags не размывали проверку.
    const tagsValues = dataRows.map((row) => row[tagsIdx]).filter(Boolean);
    expect(tagsValues).toContain("Обувь,Кроссовки");
    // Images: несколько URL разделены сырой запятой.
    const imageValues = dataRows.map((row) => row[imagesIdx]).filter(Boolean);
    expect(imageValues.some((value) => value.includes(","))).toBe(true);
  });

  it("товар с неизвестной категорией: Categories пустая, исключения нет", async () => {
    // Покрывает ветку `pathsArray?` на строке сборки Categories: categoryId,
    // которого нет в дереве категорий, → путь не строится → ячейка пустая.
    const stream = new PassThrough();
    await new Formatters.WooCommerceFormatter().format(
      stream,
      [{ ...products[0], categoryId: 999 }],
      categories,
      undefined,
    );
    const rows = parseCsv((await streamToBuffer(stream)).toString(), ";");
    const catIdx = rows[0].indexOf("Categories");

    for (const row of rows.slice(1)) {
      expect(row[catIdx] ?? "").toBe("");
    }
  });
});
