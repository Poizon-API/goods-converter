import { Formatters } from "src";
import { expect, describe, it } from "vitest";

import { categories, products } from "./constants";
import { parseCsv } from "./utils/parseCsv";
import { streamToBuffer } from "./utils/streamToBuffer";

import { PassThrough } from "stream";

// Свободный текст с сырым переносом строки, разделителем ';' и кавычкой —
// ровно то, что во входных WooCommerce-выгрузках рвало запись на две строки.
const nastyDescription =
  'Строка 1\nСтрока 2; с разделителем и "кавычками"\r\nи возвратом каретки';

describe("CSV escaping (RFC 4180)", () => {
  it('CSVFormatter: поле с \\n/;/" не разрывает запись и восстанавливается round-trip', async () => {
    const product = { ...products[0], description: nastyDescription };

    const stream = new PassThrough();
    await new Formatters.CSVFormatter().format(
      stream,
      [product],
      categories,
      undefined,
    );
    const csv = (await streamToBuffer(stream)).toString();

    const rows = parseCsv(csv, ";");
    // Запись не распалась на две физические строки.
    expect(rows).toHaveLength(2);

    const header = rows[0];
    const descIdx = header.indexOf("description");
    expect(descIdx).toBeGreaterThanOrEqual(0);
    expect(rows[1]).toHaveLength(header.length);
    expect(rows[1][descIdx]).toBe(nastyDescription);
  });

  it('TildaFormatter: поле с табом/\\n/" корректно экранируется (delimiter = \\t)', async () => {
    const product = {
      ...products[0],
      description: 'Текст с\tтабом\nи переносом и "кавычкой"',
    };

    const stream = new PassThrough();
    await new Formatters.TildaFormatter().format(
      stream,
      [product],
      categories,
      undefined,
    );
    const csv = (await streamToBuffer(stream)).toString();

    const rows = parseCsv(csv, "\t");
    expect(rows).toHaveLength(2);

    const header = rows[0];
    const textIdx = header.indexOf("Text");
    expect(textIdx).toBeGreaterThanOrEqual(0);
    expect(rows[1]).toHaveLength(header.length);
    expect(rows[1][textIdx]).toBe('Текст с\tтабом\nи переносом и "кавычкой"');
  });

  it("экранирует спецсимволы в имени колонки (setColumns), а не только в значениях", async () => {
    // Tilda строит имя колонки Characteristics:<key> из данных, поэтому ключ
    // с разделителем должен квотиться в заголовке.
    const product = {
      ...products[0],
      properties: [{ key: "размер\tобуви", value: "44" }],
    };

    const stream = new PassThrough();
    await new Formatters.TildaFormatter().format(
      stream,
      [product],
      categories,
      undefined,
    );
    const csv = (await streamToBuffer(stream)).toString();

    const header = parseCsv(csv, "\t")[0];
    expect(header).toContain("Characteristics:размер\tобуви");
  });
});
