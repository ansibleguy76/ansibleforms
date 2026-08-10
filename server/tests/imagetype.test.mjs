// tests for the logo image magic-byte sniffer ; run with `npm test` (node --test)
const { test } = await import("vitest");
import assert from "node:assert/strict";
import { sniffImageMime } from "../src/lib/imagetype.js";

test("sniffImageMime detects supported raster formats", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  assert.equal(sniffImageMime(png), "image/png");

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  assert.equal(sniffImageMime(jpeg), "image/jpeg");

  const gif87 = Buffer.concat([Buffer.from("GIF87a", "latin1"), Buffer.alloc(4)]);
  const gif89 = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(4)]);
  assert.equal(sniffImageMime(gif87), "image/gif");
  assert.equal(sniffImageMime(gif89), "image/gif");

  const webp = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1")]);
  assert.equal(sniffImageMime(webp), "image/webp");
});

test("sniffImageMime detects svg", () => {
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "image/svg+xml");
  // xml prolog, comment and doctype before the root element
  assert.equal(sniffImageMime(Buffer.from('<?xml version="1.0"?><!-- logo --><!DOCTYPE svg><svg viewBox="0 0 1 1"></svg>')), "image/svg+xml");
  // a doctype carrying an internal subset (the `>` inside it must not end the doctype early)
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg [ <!ENTITY foo "bar"> ]><svg viewBox="0 0 1 1">&foo;</svg>')), "image/svg+xml");
  // a ']' inside a quoted entity value must not terminate the internal subset early
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg [ <!ENTITY x "a]b"> ]><svg viewBox="0 0 1 1">&x;</svg>')), "image/svg+xml");
  // a ']>' inside a quoted entity value must also not terminate the subset early
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg [ <!ENTITY x "a]>b"> ]><svg viewBox="0 0 1 1">&x;</svg>')), "image/svg+xml");
  // legitimate attributes containing 'on' inside a word are not false-positives of the handler check
  assert.equal(sniffImageMime(Buffer.from('<svg font-variation-settings="wght 400" stroke-linejoin="round" viewBox="0 0 1 1"></svg>')), "image/svg+xml");
  // plain prose in a <text> node that reads like an unquoted handler is not a false-positive
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><text>online = yes</text></svg>')), "image/svg+xml");
  // a script tag is rejected as defense-in-depth, even though the logo is only rendered via <img>
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  // a namespace-prefixed script element must not bypass the literal <script check
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><s:script>alert(1)</s:script></svg>')), null);
  // a script inside a doctype-with-subset svg is still rejected
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg [ <!ENTITY foo "bar"> ]><svg><script>alert(1)</script></svg>')), null);
  // event handlers, javascript: urls and foreignObject are rejected as defense-in-depth
  assert.equal(sniffImageMime(Buffer.from('<svg onload="alert(1)" viewBox="0 0 1 1"></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><a href="javascript:alert(1)"><rect/></a></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><foreignObject><div>x</div></foreignObject></svg>')), null);
  // a namespace-prefixed foreignObject must not bypass the literal <foreignObject check
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><x:foreignObject><div>x</div></x:foreignObject></svg>')), null);
  // an xml namespace prefix is an NCName : '_', '-' and '.' are legal in it too
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns:my_ns="http://www.w3.org/2000/svg"><my_ns:script>alert(1)</my_ns:script></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns:my-ns="x"><my-ns:script>alert(1)</my-ns:script></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg><a.b:script>alert(1)</a.b:script></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg><my_ns:foreignObject><div/></my_ns:foreignObject></svg>')), null);
});

test("sniffImageMime accepts a base64 blob that looks like a handler", () => {
  // '/' is an attribute separator AND a base64 alphabet character, '=' is base64
  // padding : an embedded raster whose blob happens to end on `.../onXY=` used to
  // be refused as malicious (roughly 1 in 2600 padded blobs)
  assert.equal(sniffImageMime(Buffer.from('<svg><image xlink:href="data:image/png;base64,AAAA/onx="/></svg>')), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.from('<svg><image xlink:href="data:image/png;base64,AAAA/onab=="/></svg>')), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.from("<svg><image xlink:href='data:image/png;base64,ABC/onz='/></svg>")), "image/svg+xml");
  // a handler is still caught right after the closing quote of such a value
  assert.equal(sniffImageMime(Buffer.from('<svg><image xlink:href="data:image/png;base64,AAAA/onx="onload="alert(1)"/></svg>')), null);
  // and the SMIL check still reads INSIDE the attribute value
  assert.equal(sniffImageMime(Buffer.from('<svg><set attributeName="onclick" to="alert(1)"/></svg>')), null);
});

test("sniffImageMime accepts a namespace-prefixed or self-closing root element", () => {
  // <svg:svg> is what inkscape and xslt output produce
  assert.equal(sniffImageMime(Buffer.from('<svg:svg xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg:svg>')), "image/svg+xml");
  // an empty document closes the root element immediately
  assert.equal(sniffImageMime(Buffer.from('<svg/>')), "image/svg+xml");
  // the namespace prefix must not become a way in for dangerous content either
  assert.equal(sniffImageMime(Buffer.from('<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><script>alert(1)</script></svg:svg>')), null);
  // an element whose name merely ENDS in 'svg' is not a root element
  assert.equal(sniffImageMime(Buffer.from('<mysvg viewBox="0 0 1 1"></mysvg>')), null);
});

test("sniffImageMime accepts an apostrophe in a comment or a text node", () => {
  // a "Don't edit" banner must not open an attribute value that never closes : that
  // made '>' stop ending tags, so the prose behind it was scanned as a tag interior
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><!-- Don\'t edit --><text>status online = yes</text></svg>')), "image/svg+xml");
  // the identical document without the apostrophe was already accepted
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><!-- Do not edit --><text>status online = yes</text></svg>')), "image/svg+xml");
  // same for an exporter banner in the prolog, before the root element
  assert.equal(sniffImageMime(Buffer.from('<?xml version="1.0"?><!-- Generator: Acme. Don\'t edit! --><svg viewBox="0 0 1 1"><text>online = yes</text></svg>')), "image/svg+xml");
  // an apostrophe inside a double-quoted attribute value is not a quote opener either
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1" aria-label="It\'s a logo"></svg>')), "image/svg+xml");
  // the whole-buffer scan still catches a <script> inside a comment : the relaxed
  // quote handling may not turn comments into a parser-differential hole
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><!-- Don\'t edit --><!-- <script>alert(1)</script> --></svg>')), null);
  // and a handler behind an apostrophe-bearing comment is still refused
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><!-- Don\'t edit --><rect onload="alert(1)"/></svg>')), null);
});

test("sniffImageMime rejects a handler right after a quoted attribute value", () => {
  // the tokenizer takes the next attribute name straight after the closing quote,
  // so a '"' and a "'" are attribute separators just like whitespace
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect x="1"onload="alert(1)"/></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"onload="alert(1)">')), null);
  assert.equal(sniffImageMime(Buffer.from("<svg viewBox='0 0 1 1'><rect x='1'onload='alert(1)'/></svg>")), null);
});

test("sniffImageMime rejects handlers with an unquoted value", () => {
  // the html parser accepts an unquoted attribute value, so the handler check may not require quotes
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><rect onload=alert(1) /></svg>')), null);
  // the html parser also takes a '/' as an attribute separator
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><rect/onload=alert(1)></svg>')), null);
  // a '>' inside a quoted attribute value must not end the tag scan early and hide what follows
  assert.equal(sniffImageMime(Buffer.from('<svg title="a>b" onload=alert(1)></svg>')), null);
});

test("sniffImageMime rejects smil handler injection", () => {
  // a SMIL animation element can install a handler without any literal on...= attribute name
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><set attributeName="onclick" to="alert(1)"/></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><animate attributeName=onbegin to="alert(1)"/></svg>')), null);
  // a namespace-prefixed animation element is caught too (the attribute, not the element, is matched)
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1"><s:set attributeName="onmouseover" to="alert(1)"/></svg>')), null);
});

test("sniffImageMime accepts a long prolog before the root element", () => {
  // an embedded license/generator comment may be longer than any sniff window
  assert.equal(sniffImageMime(Buffer.from('<!--' + 'x'.repeat(5000) + '-->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "image/svg+xml");
  // so may an inline dtd
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg [ <!ENTITY x "' + 'y'.repeat(5000) + '"> ]><svg viewBox="0 0 1 1">&x;</svg>')), "image/svg+xml");
  // the standard SVG 1.1 doctype stays accepted
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg viewBox="0 0 1 1"></svg>')), "image/svg+xml");
  // dangerous content far past the old 4096 byte window is still caught
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>' + 'a'.repeat(5000) + '</text><script>alert(1)</script></svg>')), null);
  // an unterminated prolog construct is refused (and must not loop forever)
  assert.equal(sniffImageMime(Buffer.from('<!DOCTYPE svg [ <!ENTITY x "a"> ><svg viewBox="0 0 1 1"></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<!-- unterminated <svg viewBox="0 0 1 1"></svg>')), null);
});

test("sniffImageMime stays linear on adversarial input", () => {
  // every character is visited once, so a big document with many apostrophes, many
  // '<' or many bare '=' must not blow up (a quadratic scan would time this out)
  assert.equal(sniffImageMime(Buffer.from('<svg viewBox="0 0 1 1">' + "<!-- Don't -->".repeat(80000) + '</svg>')), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.from('<svg ' + 'a="b" '.repeat(200000) + '></svg>')), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.from('<svg>' + "'".repeat(1500000) + '</svg>')), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.from('<svg>' + '<'.repeat(1500000) + '</svg>')), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.from('<svg>' + '="'.repeat(700000) + '</svg>')), "image/svg+xml");
});

test("sniffImageMime handles utf-8 and utf-16 encoded svg", () => {
  const svg = '<svg viewBox="0 0 1 1"></svg>';
  const utf16le = (s) => Buffer.from(s, "utf16le");
  const utf16be = (s) => { const b = Buffer.from(s, "utf16le"); b.swap16(); return b; };

  assert.equal(sniffImageMime(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(svg)])), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le(svg)])), "image/svg+xml");
  assert.equal(sniffImageMime(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be(svg)])), "image/svg+xml");
  // the dangerous content scan runs over the decoded text, so utf-16 can't hide a payload
  assert.equal(sniffImageMime(Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le('<svg><script>alert(1)</script></svg>')])), null);
  assert.equal(sniffImageMime(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be('<svg><rect onload=alert(1)/></svg>')])), null);
  // a BOM with nothing behind it is not an image
  assert.equal(sniffImageMime(Buffer.from([0xff, 0xfe])), null);
});

test("sniffImageMime rejects everything else", () => {
  // html disguised as an image
  assert.equal(sniffImageMime(Buffer.from("<html><script>alert(1)</script></html>")), null);
  // truncated signatures
  assert.equal(sniffImageMime(Buffer.from([0x89, 0x50])), null);
  assert.equal(sniffImageMime(Buffer.from("RIFFxxxx", "latin1")), null);
  // empty or not a buffer at all
  assert.equal(sniffImageMime(Buffer.alloc(0)), null);
  assert.equal(sniffImageMime("not a buffer"), null);
  assert.equal(sniffImageMime(undefined), null);
});
