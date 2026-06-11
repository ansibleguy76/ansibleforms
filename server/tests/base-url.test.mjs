// tests for the subpath hosting helpers (issue #106) ; run with `npm test` (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBaseUrl, injectBaseUrl } from "../src/lib/baseurl.js";

test("normalizeBaseUrl", () => {
  // root hosting
  assert.equal(normalizeBaseUrl(undefined), "");
  assert.equal(normalizeBaseUrl(""), "");
  assert.equal(normalizeBaseUrl("/"), "");
  assert.equal(normalizeBaseUrl(" / "), "");
  // subpath hosting, any slash style is accepted
  assert.equal(normalizeBaseUrl("/ansibleforms"), "/ansibleforms");
  assert.equal(normalizeBaseUrl("ansibleforms"), "/ansibleforms");
  assert.equal(normalizeBaseUrl("/ansibleforms/"), "/ansibleforms");
  assert.equal(normalizeBaseUrl("ansibleforms/"), "/ansibleforms");
  // nested subpath
  assert.equal(normalizeBaseUrl("/apps/ansibleforms/"), "/apps/ansibleforms");
});

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <base href="/" />
  <link rel="icon" href="favicon.svg" />
</head>
<body></body>
</html>`;

test("injectBaseUrl rewrites the base tag", () => {
  const html = injectBaseUrl(INDEX_HTML, "/ansibleforms");
  assert.match(html, /<base href="\/ansibleforms\/" \/>/);
  assert.equal(html.match(/<base /g).length, 1);
  // root hosting keeps a plain base tag
  const rootHtml = injectBaseUrl(INDEX_HTML, "");
  assert.match(rootHtml, /<base href="\/" \/>/);
});

test("injectBaseUrl inserts a base tag when missing (older build)", () => {
  const html = injectBaseUrl("<html><head><link rel=\"icon\" href=\"favicon.svg\" /></head></html>", "/ansibleforms");
  assert.match(html, /<head>\s*<base href="\/ansibleforms\/" \/>/);
});

test("injectBaseUrl handles empty input", () => {
  assert.equal(injectBaseUrl(null, "/x"), null);
  assert.equal(injectBaseUrl("", "/x"), "");
});
