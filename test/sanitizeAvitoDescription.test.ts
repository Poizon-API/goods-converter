import {
  clampPartialHtml,
  sanitizeAvitoDescription,
} from "src/formatter/avito/sanitizeDescription";
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
      expect(sanitizeAvitoDescription("a]]>b")).toBe("a]]&gt;b");
    });

    it("уже-эскейпнутый `&amp;` остаётся idempotent (no double-escape)", () => {
      // Upstream-парсер часто отдаёт HTML-encoded text; sanitize-html
      // decode-then-encode сохраняет канонический вид. Регрессия в эту
      // сторону (parser: { decodeEntities: false }) дала бы `&amp;amp;`
      // в выходе и дословный `&amp;` в UI Avito.
      expect(sanitizeAvitoDescription("Skirt &amp; blouse")).toBe(
        "Skirt &amp; blouse",
      );
      expect(sanitizeAvitoDescription("&lt;tag&gt;")).toBe("&lt;tag&gt;");
    });

    it("множественные <br><br><br> сохраняются по одному", () => {
      // Spec: «Тег n преобразуется в br, интервалы между абзацами будут
      // увеличены» — Avito НЕ collapse'ит подряд идущие <br>. Фиксируем
      // pass-through, чтобы будущий апгрейд sanitize-html не схлопывал.
      expect(sanitizeAvitoDescription("a<br><br><br>b")).toBe(
        "a<br /><br /><br />b",
      );
    });

    it("uppercase <BR>, <P> приводится к lowercase", () => {
      // sanitize-html по-default'у lowercases tag names. Фиксируем
      // контракт: <BR> и <P> на входе попадут в allowlist'е (который у
      // нас в lowercase).
      expect(sanitizeAvitoDescription("a<BR>b<P>c</P>")).toBe(
        "a<br />b<p>c</p>",
      );
    });

    it("малформированный HTML не падает: <p>unclosed, <<<, mis-nested", () => {
      // Snapshot текущего поведения sanitize-html — регресс-guard на
      // апгрейд библиотеки.
      expect(sanitizeAvitoDescription("<p>unclosed")).toBe("<p>unclosed</p>");
      // `<<<` не парсится как валидный тег — sanitize-html эскейпит все
      // три `<` в text-node как `&lt;`. На Avito-стороне это рендерится
      // как литеральный `<<<` (HTML5-parser декодирует `&lt;` обратно).
      expect(sanitizeAvitoDescription("<<<")).toBe("&lt;&lt;&lt;");
      expect(sanitizeAvitoDescription("<p><strong>x</p></strong>")).toBe(
        "<p><strong>x</strong></p>",
      );
    });

    it("вложенные запрещённые теги до 3 уровней стрипаются полностью", () => {
      expect(
        sanitizeAvitoDescription(
          '<div><span><a href="x">текст</a></span></div>',
        ),
      ).toBe("текст");
    });

    it("emoji + entities + tags в одной строке корректно процессятся", () => {
      expect(sanitizeAvitoDescription("<p>👟 Nike &amp; Adidas 🔥</p>")).toBe(
        "<p>👟 Nike &amp; Adidas 🔥</p>",
      );
    });
  });
});

describe("clampPartialHtml", () => {
  describe("снимает оборванный тег с конца", () => {
    it.each([
      ["<p", ""],
      ["<br /", ""],
      ["<strong", ""],
      ["</li", ""],
      ["text<p", "text"],
      ["<p>x</p", "<p>x"],
    ])("'%s' → '%s'", (input, expected) => {
      expect(clampPartialHtml(input)).toBe(expected);
    });
  });

  describe("снимает оборванный entity с конца", () => {
    it.each([
      ["&am", ""],
      ["&amp", ""],
      ["&lt", ""],
      ["&#12", ""],
      ["&#x1A", ""],
      ["text&am", "text"],
      ["xx&amp", "xx"],
    ])("'%s' → '%s'", (input, expected) => {
      expect(clampPartialHtml(input)).toBe(expected);
    });
  });

  describe("оставляет валидные хвосты as-is", () => {
    it.each([
      // Закрытые теги
      ["<p>x</p>", "<p>x</p>"],
      ["<br />", "<br />"],
      // Закрытые entity
      ["&amp;", "&amp;"],
      ["x&lt;y", "x&lt;y"],
      ["&#39;", "&#39;"],
      // Lone `&` — HTML5 рендерит как литерал `&`
      ["text&", "text&"],
      ["a & b", "a & b"],
      // Lone `<` — HTML5 рендерит как литерал
      ["text<", "text<"],
      // Plain text
      ["plain text", "plain text"],
      // Пустая строка
      ["", ""],
    ])("'%s' → '%s'", (input, expected) => {
      expect(clampPartialHtml(input)).toBe(expected);
    });
  });
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
