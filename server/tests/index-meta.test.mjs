// The instance's name and its labels told to the page in index.html (src/lib/indexMeta.js) :
// the sign-in card and the header draw them from the first frame. They are admin-typed texts put
// in an html attribute, so they must be escaped.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { escapeAttribute, setMeta, injectAppIdentity } from "../src/lib/indexMeta.js";

const html = '<!DOCTYPE html>\n<html>\n<head>\n  <base href="/" />\n</head>\n<body></body>\n</html>';
const meta = (out, name) => out.match(new RegExp(`<meta name="${name}" content="([^"]*)" />`))?.[1];

describe("the instance's name and label in index.html", () => {
  test("the values, in meta tags of the head : the labels shown as JSON, in their order", () => {
    const out = injectAppIdentity(html, { appName: "Forms Prod", labels: [{ name: "PRODUCTION", color: "red" }, { name: "EU", color: "blue" }] });
    assert.equal(meta(out, "af-app-name"), "Forms Prod");
    const raw = meta(out, "af-labels").replace(/&quot;/g, '"');
    assert.deepEqual(JSON.parse(raw), [{ name: "PRODUCTION", color: "red" }, { name: "EU", color: "blue" }]);
  });

  test("none set: the tags say so, empty", () => {
    const out = injectAppIdentity(html, { appName: null, labels: [] });
    assert.equal(meta(out, "af-app-name"), "");
    assert.equal(meta(out, "af-labels"), "");
  });

  test("a label cannot break out of its attribute", () => {
    const out = injectAppIdentity(html, { appName: "x", labels: [{ name: `"><script>alert(1)</script>`, color: "red" }] });
    assert.doesNotMatch(out, /<script/i);
  });

  test("not readable (null): the page is left without the tags", () => {
    assert.equal(injectAppIdentity(html, null), html);
  });

  test("a name cannot break out of its attribute", () => {
    const out = injectAppIdentity(html, { appName: `Ops "R&D" <script>alert('x')</script>`, labels: [] });
    assert.equal(meta(out, "af-app-name"), "Ops &quot;R&amp;D&quot; &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    assert.doesNotMatch(out, /<script/i);
  });

  test("a $ in a name is kept as it is (not a replacement pattern)", () => {
    const out = injectAppIdentity(html, { appName: "Cost $& $1 center", labels: [] });
    assert.equal(meta(out, "af-app-name"), "Cost $&amp; $1 center");
  });

  test("a tag already there is replaced, never doubled", () => {
    const once = setMeta(html, "af-app-name", "One");
    const twice = setMeta(once, "af-app-name", "Two");
    assert.equal((twice.match(/name="af-app-name"/g) || []).length, 1);
    assert.equal(meta(twice, "af-app-name"), "Two");
  });

  test("every character that matters in an attribute is escaped", () => {
    assert.equal(escapeAttribute(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
    assert.equal(escapeAttribute(undefined), "");
  });
});
