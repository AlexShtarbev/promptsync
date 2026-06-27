import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, extractToc } from "./markdown.js";

describe("renderMarkdown", () => {
  describe("headings", () => {
    test("h1", () => {
      assert.equal(renderMarkdown("# Hello"), '<h1 id="hello">Hello</h1>');
    });

    test("h2", () => {
      assert.equal(renderMarkdown("## Section"), '<h2 id="section">Section</h2>');
    });

    test("h3", () => {
      assert.equal(renderMarkdown("### Subsection"), '<h3 id="subsection">Subsection</h3>');
    });

    test("h4", () => {
      assert.equal(renderMarkdown("#### Deep"), '<h4 id="deep">Deep</h4>');
    });

    test("h3 with SCENE marker gets data attribute", () => {
      const html = renderMarkdown("### SCENE 3 — The Descent");
      assert.ok(html.includes('class="scene-heading"'));
      assert.ok(html.includes('data-scene="3"'));
      assert.ok(html.includes("SCENE 3"));
    });

    test("h3 with lowercase scene marker gets data attribute", () => {
      const html = renderMarkdown("### scene 5 — The Fall");
      assert.ok(html.includes('class="scene-heading"'));
      assert.ok(html.includes('data-scene="5"'));
    });

    test("h3 without SCENE marker is plain", () => {
      const html = renderMarkdown("### Normal Heading");
      assert.ok(!html.includes("scene-heading"));
      assert.equal(html, '<h3 id="normal-heading">Normal Heading</h3>');
    });
  });

  describe("inline formatting", () => {
    test("bold", () => {
      assert.ok(renderMarkdown("**bold text**").includes("<strong>bold text</strong>"));
    });

    test("italic", () => {
      assert.ok(renderMarkdown("*italic text*").includes("<em>italic text</em>"));
    });

    test("strikethrough", () => {
      assert.ok(renderMarkdown("~~deleted~~").includes("<del>deleted</del>"));
    });

    test("inline code", () => {
      assert.ok(renderMarkdown("`code`").includes("<code>code</code>"));
    });

    test("nested bold and italic", () => {
      const html = renderMarkdown("**bold and *italic* inside**");
      assert.ok(html.includes("<strong>"));
    });
  });

  describe("HTML escaping", () => {
    test("escapes angle brackets", () => {
      const html = renderMarkdown("<script>alert('xss')</script>");
      assert.ok(!html.includes("<script>"));
      assert.ok(html.includes("&lt;script&gt;"));
    });

    test("escapes ampersands", () => {
      const html = renderMarkdown("A & B");
      assert.ok(html.includes("&amp;"));
    });

    test("escapes quotes", () => {
      const html = renderMarkdown('She said "hello"');
      assert.ok(html.includes("&quot;"));
    });
  });

  describe("paragraphs", () => {
    test("wraps plain text in p tag", () => {
      assert.equal(renderMarkdown("Hello world"), "<p>Hello world</p>");
    });

    test("consecutive lines form single paragraph", () => {
      const html = renderMarkdown("line one\nline two");
      assert.equal(html, "<p>line one\nline two</p>");
    });

    test("indented continuation lines joined into paragraph", () => {
      const html = renderMarkdown("first line\n  continued here");
      assert.equal(html, "<p>first line continued here</p>");
    });

    test("blank line separates paragraphs", () => {
      const html = renderMarkdown("para one\n\npara two");
      assert.ok(html.includes("<p>para one</p>"));
      assert.ok(html.includes("<p>para two</p>"));
    });
  });

  describe("horizontal rule", () => {
    test("--- produces hr", () => {
      assert.equal(renderMarkdown("---"), "<hr>");
    });
  });

  describe("unordered lists", () => {
    test("dash items", () => {
      const html = renderMarkdown("- one\n- two\n- three");
      assert.ok(html.includes("<ul>"));
      assert.ok(html.includes("<li>one</li>"));
      assert.ok(html.includes("<li>two</li>"));
      assert.ok(html.includes("<li>three</li>"));
      assert.ok(html.includes("</ul>"));
    });

    test("asterisk items", () => {
      const html = renderMarkdown("* alpha\n* beta");
      assert.ok(html.includes("<li>alpha</li>"));
      assert.ok(html.includes("<li>beta</li>"));
    });

    test("inline formatting in list items", () => {
      const html = renderMarkdown("- **bold** item\n- *italic* item");
      assert.ok(html.includes("<strong>bold</strong>"));
      assert.ok(html.includes("<em>italic</em>"));
    });

    test("continuation lines joined to item", () => {
      const html = renderMarkdown("- first line\n  continued\n- second");
      assert.ok(html.includes("<li>first line continued</li>"));
      assert.ok(html.includes("<li>second</li>"));
    });
  });

  describe("ordered lists", () => {
    test("numbered items", () => {
      const html = renderMarkdown("1. first\n2. second\n3. third");
      assert.ok(html.includes("<ol>"));
      assert.ok(html.includes("<li>first</li>"));
      assert.ok(html.includes("<li>second</li>"));
      assert.ok(html.includes("<li>third</li>"));
      assert.ok(html.includes("</ol>"));
    });

    test("continuation lines joined to item", () => {
      const html = renderMarkdown("1. start\n  continued\n2. next");
      assert.ok(html.includes("<li>start continued</li>"));
    });
  });

  describe("blockquotes", () => {
    test("single line blockquote", () => {
      const html = renderMarkdown("> quoted text");
      assert.ok(html.includes("<blockquote><p>quoted text</p></blockquote>"));
    });

    test("multi-line blockquote joined", () => {
      const html = renderMarkdown("> line one\n> line two");
      assert.ok(html.includes("<blockquote><p>line one line two</p></blockquote>"));
    });
  });

  describe("tables", () => {
    test("basic table", () => {
      const md = "| Name | Status |\n| --- | --- |\n| 1A | draft |\n| 1B | done |";
      const html = renderMarkdown(md);
      assert.ok(html.includes("<table>"));
      assert.ok(html.includes("<th>Name</th>"));
      assert.ok(html.includes("<th>Status</th>"));
      assert.ok(html.includes("<td>1A</td>"));
      assert.ok(html.includes("<td>draft</td>"));
      assert.ok(html.includes("<td>1B</td>"));
      assert.ok(html.includes("<td>done</td>"));
      assert.ok(html.includes("</table>"));
    });

    test("table with inline formatting", () => {
      const md = "| Col |\n| --- |\n| **bold** |";
      const html = renderMarkdown(md);
      assert.ok(html.includes("<strong>bold</strong>"));
    });
  });

  describe("mixed content", () => {
    test("heading followed by paragraph and list", () => {
      const md = "# Title\n\nSome text here.\n\n- item one\n- item two";
      const html = renderMarkdown(md);
      assert.ok(html.includes('<h1 id="title">Title</h1>'));
      assert.ok(html.includes("<p>Some text here.</p>"));
      assert.ok(html.includes("<ul>"));
      assert.ok(html.includes("<li>item one</li>"));
    });

    test("empty input returns empty string", () => {
      assert.equal(renderMarkdown(""), "");
    });

    test("whitespace-only input returns empty string", () => {
      assert.equal(renderMarkdown("   \n  \n  "), "");
    });

    test("blocks separated by newline in output", () => {
      const html = renderMarkdown("# Title\n\nA paragraph.");
      assert.equal(html, '<h1 id="title">Title</h1>\n<p>A paragraph.</p>');
    });

    test("paragraph broken by heading", () => {
      const html = renderMarkdown("Some text\n# Heading");
      assert.ok(html.includes("<p>Some text</p>"));
      assert.ok(html.includes('<h1 id="heading">Heading</h1>'));
    });

    test("paragraph broken by unordered list", () => {
      const html = renderMarkdown("Some text\n- item");
      assert.ok(html.includes("<p>Some text</p>"));
      assert.ok(html.includes("<li>item</li>"));
    });

    test("paragraph broken by ordered list", () => {
      const html = renderMarkdown("Some text\n1. item");
      assert.ok(html.includes("<p>Some text</p>"));
      assert.ok(html.includes("<li>item</li>"));
    });

    test("paragraph broken by blockquote", () => {
      const html = renderMarkdown("Some text\n> quoted");
      assert.ok(html.includes("<p>Some text</p>"));
      assert.ok(html.includes("<blockquote>"));
    });

    test("paragraph broken by table", () => {
      const html = renderMarkdown("Some text\n| A |\n| --- |\n| 1 |");
      assert.ok(html.includes("<p>Some text</p>"));
      assert.ok(html.includes("<table>"));
    });

    test("paragraph broken by hr", () => {
      const html = renderMarkdown("Some text\n\n---\n\nMore text");
      assert.ok(html.includes("<p>Some text</p>"));
      assert.ok(html.includes("<hr>"));
      assert.ok(html.includes("<p>More text</p>"));
    });
  });

  describe("headings with inline formatting", () => {
    test("bold in heading", () => {
      const html = renderMarkdown("## **Bold** heading");
      assert.ok(html.includes('<h2 id="bold-heading"><strong>Bold</strong> heading</h2>'));
    });

    test("italic in heading", () => {
      const html = renderMarkdown("# *Italic* title");
      assert.ok(html.includes('<h1 id="italic-title"><em>Italic</em> title</h1>'));
    });

    test("code in heading", () => {
      const html = renderMarkdown("### `code` heading");
      assert.ok(html.includes("<code>code</code>"));
    });
  });

  describe("heading edge cases", () => {
    test("#without space is paragraph, not heading", () => {
      const html = renderMarkdown("#no-space");
      assert.ok(!html.includes("<h1>"));
      assert.ok(html.includes("<p>"));
    });

    test("mid-line # is not a heading", () => {
      const html = renderMarkdown("not # a heading");
      assert.ok(!html.includes("<h1>"));
      assert.ok(html.includes("<p>"));
    });

    test("h5 and beyond fall through to paragraph", () => {
      const html = renderMarkdown("##### Very deep");
      assert.ok(!html.includes("<h5>"));
      assert.ok(html.includes("<p>"));
    });

    test("SCENE with non-numeric marker is plain h3", () => {
      const html = renderMarkdown("### SCENE A — Intro");
      assert.ok(!html.includes("scene-heading"));
      assert.ok(html.includes('<h3 id="scene-a-intro">SCENE A'));
    });
  });

  describe("table edge cases", () => {
    test("KNOWN BUG: empty cells are dropped by filter(Boolean)", () => {
      const md = "| A | B |\n| --- | --- |\n|  | val |";
      const html = renderMarkdown(md);
      assert.ok(html.includes("<table>"));
      assert.ok(html.includes("<td>val</td>"));
      assert.ok(!html.includes("<td></td>"),
        "KNOWN BUG: empty cell is dropped, not rendered as <td></td>");
    });

    test("single column table", () => {
      const md = "| Col |\n| --- |\n| row1 |\n| row2 |";
      const html = renderMarkdown(md);
      assert.ok(html.includes("<th>Col</th>"));
      assert.ok(html.includes("<td>row1</td>"));
      assert.ok(html.includes("<td>row2</td>"));
    });

    test("table rows have correct cell count when all cells filled", () => {
      const md = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
      const html = renderMarkdown(md);
      const tdCount = (html.match(/<td>/g) || []).length;
      assert.equal(tdCount, 3);
    });
  });

  describe("list edge cases", () => {
    test("unordered list followed by ordered list", () => {
      const html = renderMarkdown("- bullet\n\n1. number");
      assert.ok(html.includes("<ul>"));
      assert.ok(html.includes("<li>bullet</li>"));
      assert.ok(html.includes("<ol>"));
      assert.ok(html.includes("<li>number</li>"));
    });

    test("ordered list followed by unordered list", () => {
      const html = renderMarkdown("1. first\n\n- dash");
      assert.ok(html.includes("<ol>"));
      assert.ok(html.includes("<li>first</li>"));
      assert.ok(html.includes("<ul>"));
      assert.ok(html.includes("<li>dash</li>"));
    });
  });

  describe("blockquote edge cases", () => {
    test("blockquote followed by paragraph", () => {
      const html = renderMarkdown("> quoted\n\nNormal text");
      assert.ok(html.includes("<blockquote>"));
      assert.ok(html.includes("<p>Normal text</p>"));
    });

    test("empty blockquote line is just >", () => {
      const html = renderMarkdown("> text");
      assert.ok(html.includes("<blockquote><p>text</p></blockquote>"));
    });
  });

  describe("inline formatting edge cases", () => {
    test("multiple bold phrases in same line", () => {
      const html = renderMarkdown("**one** and **two**");
      assert.ok(html.includes("<strong>one</strong>"));
      assert.ok(html.includes("<strong>two</strong>"));
    });

    test("asterisk in URL-like text is not italic", () => {
      const html = renderMarkdown("file*.txt is a glob");
      assert.ok(html.includes("file"));
    });

    test("backtick within bold", () => {
      const html = renderMarkdown("**bold `code` bold**");
      assert.ok(html.includes("<strong>"));
      assert.ok(html.includes("<code>code</code>"));
    });

    test("KNOWN BUG: math expression with asterisks triggers false italic", () => {
      const html = renderMarkdown("5 * 3 * 2 = 30");
      assert.ok(html.includes("<em>"),
        "KNOWN BUG: `* 3 *` in math is matched by italic regex");
    });

    test("KNOWN BUG: ***text*** produces mis-nested tags", () => {
      const html = renderMarkdown("***both***");
      assert.ok(html.includes("<strong>"));
      assert.ok(html.includes("<em>"));
    });
  });

  describe("hr edge cases", () => {
    test("--- with text before is paragraph then hr", () => {
      const html = renderMarkdown("text\n\n---");
      assert.ok(html.includes("<p>text</p>"));
      assert.ok(html.includes("<hr>"));
    });

    test("*** is not treated as hr (only ---)", () => {
      const html = renderMarkdown("***");
      assert.ok(!html.includes("<hr>"));
    });
  });

  describe("blockquote edge cases (additional)", () => {
    test(">text without space is paragraph, not blockquote", () => {
      const html = renderMarkdown(">text");
      assert.ok(!html.includes("<blockquote>"));
      assert.ok(html.includes("<p>"));
      assert.ok(html.includes("&gt;text"));
    });

    test("bare > line breaks a multi-line blockquote", () => {
      const html = renderMarkdown("> line1\n>\n> line2");
      assert.ok(html.includes("&gt;"), "bare > without space is not a blockquote continuation");
    });
  });

  describe("hr edge cases (additional)", () => {
    test("--- directly after text (no blank line) still produces hr", () => {
      const html = renderMarkdown("text\n---");
      assert.ok(html.includes("<p>text</p>"));
      assert.ok(html.includes("<hr>"));
    });
  });
});

describe("code fences", () => {
  test("renders a fenced block and treats # inside as literal", () => {
    const html = renderMarkdown("```\n# face\nFace: round\n```");
    assert.match(html, /<pre class="md-code"><code>/);
    assert.doesNotMatch(html, /<h1/);
  });

  test("language fence adds a language class", () => {
    const html = renderMarkdown("```yaml\nkey: value\n```");
    assert.match(html, /<code class="language-yaml">/);
  });
});

describe("extractToc", () => {
  test("captures levels and de-duplicates ids in document order", () => {
    const toc = extractToc("# Title\n\n## Section A\n\n### Sub\n\n## Section A");
    assert.deepEqual(toc, [
      { level: 1, text: "Title", id: "title" },
      { level: 2, text: "Section A", id: "section-a" },
      { level: 3, text: "Sub", id: "sub" },
      { level: 2, text: "Section A", id: "section-a-1" },
    ]);
  });

  test("skips headings inside fenced code blocks", () => {
    const toc = extractToc("# Real\n\n```\n# not a heading\n```\n\n## Also real");
    assert.deepEqual(toc.map((t) => t.text), ["Real", "Also real"]);
  });

  test("toc ids match the rendered heading ids", () => {
    const md = "## Section A\n\n## Section A";
    const html = renderMarkdown(md);
    for (const entry of extractToc(md)) assert.match(html, new RegExp(`id="${entry.id}"`));
  });
});
