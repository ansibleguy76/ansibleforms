// tests for the logo image magic-byte sniffer ; run with `npm test` (node --test)
import { test } from "node:test";
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

test("sniffImageMime rejects everything else", () => {
  // svg is deliberately unsupported (can embed scripts)
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
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
