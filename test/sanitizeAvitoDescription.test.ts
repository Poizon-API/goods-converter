import { sanitizeAvitoDescription } from "src/formatter/avito/sanitizeDescription";
import { describe, expect, it } from "vitest";

describe("sanitizeAvitoDescription", () => {
  describe("пропускает allowlist as-is", () => {
    it("plain text без тегов не трогается", () => {
      expect(sanitizeAvitoDescription("Кроссовки Nike, новые")).toBe(
        "Кроссовки Nike, новые",
      );
    });

    it.each([
      ["p", "<p>абзац</p>", "<p>абзац</p>"],
      ["strong", "<strong>важно</strong>", "<strong>важно</strong>"],
      ["em", "<em>курсив</em>", "<em>курсив</em>"],
      [
        "ul/li",
        "<ul><li>a</li><li>b</li></ul>",
        "<ul><li>a</li><li>b</li></ul>",
      ],
      [
        "ol/li",
        "<ol><li>a</li><li>b</li></ol>",
        "<ol><li>a</li><li>b</li></ol>",
      ],
    ])("тег <%s> сохраняется", (_label, input, expected) => {
      expect(sanitizeAvitoDescription(input)).toBe(expected);
    });

    it("<br> нормализуется в <br />", () => {
      expect(sanitizeAvitoDescription("a<br>b")).toBe("a<br />b");
      expect(sanitizeAvitoDescription("a<br/>b")).toBe("a<br />b");
    });
  });

  describe("стрипает запрещённые теги, оставляя inner text", () => {
    it.each([
      ["div", "<div>текст</div>", "текст"],
      ["span", "<span>текст</span>", "текст"],
      ["h1", "<h1>заголовок</h1>", "заголовок"],
      ["h2", "<h2>заголовок</h2>", "заголовок"],
      ["h6", "<h6>заголовок</h6>", "заголовок"],
      ["table", "<table><tr><td>x</td></tr></table>", "x"],
      ["a", '<a href="https://evil.com">click</a>', "click"],
      ["u", "<u>подчёркнуто</u>", "подчёркнуто"],
    ])("тег <%s> вырезается, текст остаётся", (_label, input, expected) => {
      expect(sanitizeAvitoDescription(input)).toBe(expected);
    });

    it("вложенные запрещённые теги (<div><p>x</p></div>) → <p>x</p>", () => {
      expect(sanitizeAvitoDescription("<div><p>x</p></div>")).toBe("<p>x</p>");
    });

    it("<img> вырезается полностью (нет inner text)", () => {
      expect(sanitizeAvitoDescription('пред<img src="x.jpg" />пост')).toBe(
        "предпост",
      );
    });

    it("<script> вырезается ВМЕСТЕ с содержимым (default sanitize-html policy)", () => {
      // sanitize-html по-умолчанию reaped'ит content из nonTextTags
      // (script/style/textarea/noscript) — это XSS-safe default.
      expect(
        sanitizeAvitoDescription("до<script>alert('x')</script>после"),
      ).toBe("допосле");
    });
  });

  describe("вырезает атрибуты у разрешённых тегов", () => {
    it("<p class='x'> → <p>", () => {
      expect(sanitizeAvitoDescription('<p class="hero">x</p>')).toBe(
        "<p>x</p>",
      );
    });

    it("<strong style='color:red'> → <strong>", () => {
      expect(
        sanitizeAvitoDescription('<strong style="color:red">x</strong>'),
      ).toBe("<strong>x</strong>");
    });

    it("<ul data-foo='bar'> → <ul>", () => {
      expect(
        sanitizeAvitoDescription('<ul data-foo="bar"><li>x</li></ul>'),
      ).toBe("<ul><li>x</li></ul>");
    });
  });

  describe("трансформирует синонимы", () => {
    it("<b> → <strong>", () => {
      expect(sanitizeAvitoDescription("<b>важно</b>")).toBe(
        "<strong>важно</strong>",
      );
    });

    it("<i> → <em>", () => {
      expect(sanitizeAvitoDescription("<i>курсив</i>")).toBe("<em>курсив</em>");
    });

    it("<b class='x'> → <strong> (атрибуты тоже отбрасываются)", () => {
      expect(sanitizeAvitoDescription('<b class="x">y</b>')).toBe(
        "<strong>y</strong>",
      );
    });
  });

  describe("edge cases", () => {
    it("пустая строка возвращается as-is", () => {
      expect(sanitizeAvitoDescription("")).toBe("");
    });

    it("`\\n` НЕ конвертируется в <br/> (Avito делает сам)", () => {
      // Avito-spec: «Тег n (перенос строки) преобразуется в br». Если мы
      // тоже заменим — получим двойные <br>, раздутые интервалы.
      expect(sanitizeAvitoDescription("первая\nвторая")).toBe("первая\nвторая");
    });

    it("`&` в plain-text эскейпится в `&amp;` (HTML output)", () => {
      // CDATA не процессит entity, но Avito рендерит content как HTML —
      // entity декодится обратно в `&` на странице объявления. OK.
      expect(sanitizeAvitoDescription("Skirt & blouse")).toBe(
        "Skirt &amp; blouse",
      );
    });

    it("CDATA-terminator `]]>` эскейпится в `]]&gt;` (защита от premature close)", () => {
      // sanitize-html сам по-default'у энтити-эскейпит `>` в text-node.
      // Это делает старый getSafeCdata'шный split (`]]]]><![CDATA[>`)
      // ненужным для нормальных входов, но getSafeCdata оставлен как
      // belt-and-suspenders в формattере.
      expect(sanitizeAvitoDescription("a]]>b")).toBe("a]]&gt;b");
    });

    it("комбинированный realistic-кейс из upstream-парсера", () => {
      const raw =
        '<div class="desc"><h2>Кроссовки Nike</h2>' +
        "<p>Состояние: <b>новые</b>, с биркой.<br>" +
        "Размеры: <i>40-45</i></p>" +
        "<ul><li>Оригинал</li><li>Из США</li></ul>" +
        '<a href="https://site.ru">Подробнее</a></div>';
      expect(sanitizeAvitoDescription(raw)).toBe(
        "Кроссовки Nike" +
          "<p>Состояние: <strong>новые</strong>, с биркой.<br />Размеры: <em>40-45</em></p>" +
          "<ul><li>Оригинал</li><li>Из США</li></ul>" +
          "Подробнее",
      );
    });
  });
});
