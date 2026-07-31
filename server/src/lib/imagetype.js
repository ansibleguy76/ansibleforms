// minimal magic-byte sniffing for the custom logo upload ; we never trust the
// client-declared content type. Svg is allowed because the logo is only ever
// rendered through an <img> with a data url, where browsers never execute
// embedded scripts or load external resources. As defense-in-depth (in case the
// svg is ever inlined into the DOM in the future) we still reject anything that
// carries active content : a <script> element (incl. a namespace-prefixed one
// like <s:script>), an inline on<event>= handler (quoted OR unquoted), a SMIL
// animation that installs a handler attribute, a javascript: url, or a
// <foreignObject> (incl. <x:foreignObject>, which can host a foreign/html
// namespace).
//
// KNOWN LIMITATION (accepted) : character-reference-encoded payloads (e.g.
// `&#106;avascript:` for `javascript:`) are NOT decoded before matching, so
// they would slip past this check. Acceptable because the logo is only ever
// served via <img src="data:...">, where such content is inert ; a real XML
// sanitizer would be required if the svg were ever inlined into the page.

// element/url level checks : matched over the WHOLE text, wherever it appears
// - element names may carry an optional `prefix:` namespace so <s:script> /
//   <x:foreignObject> can't bypass the literal names. An xml namespace prefix is
//   an NCName, so besides letters and digits it may contain '_', '-' and '.' -
//   <my_ns:script> is as valid (and as executable) as <s:script>
const SVG_DANGEROUS = /<(?:[a-z0-9_.-]+:)?script|javascript:|<(?:[a-z0-9_.-]+:)?foreignObject/i;

// attribute level checks : matched over the interior of a markup tag only (see
// markupInteriors), never over a text node
// - an inline event handler with a quoted OR an unquoted value : xml requires
//   quotes, but the html parser - which is exactly the case this defense-in-depth
//   is for - accepts `<rect onload=alert(1)/>` just as happily, and it also takes
//   a '/' as an attribute separator (`<rect/onload=alert(1)>`). Matching inside a
//   tag only is what keeps prose like `online = yes` in a <text> node from
//   false-positiving, so the quotes are not needed to tell them apart.
//   A '"' and a "'" are attribute separators too : the tokenizer's
//   after-attribute-value-(quoted) state takes the next attribute name right after
//   the closing quote, so `<rect x="1"onload="alert(1)"/>` and
//   `<svg xmlns="..."onload="alert(1)">` install a handler without any whitespace.
//   This one is matched over the tag interior with the quoted attribute VALUES cut
//   out (markupInteriors yields that separately), because '/' is also a base64
//   alphabet character and '=' its padding : a legitimate svg embedding a raster
//   image whose base64 blob happens to end on `.../onXY=` was refused as malicious
//   (measured at roughly 1 in 2600 padded blobs). A value can never install a
//   handler by itself, and the quotes are kept so the closing quote of the previous
//   attribute still separates the attribute name that follows it.
const SVG_DANGEROUS_ATTR = /(?:^|[\s/"'])on[a-z0-9_.:-]+\s*=/i;

// - a SMIL animation element writing an on<event> attribute :
//   `<set attributeName="onclick" to="alert(1)"/>` installs a handler without the
//   literal `on...=` ever appearing as an attribute name. Here the attribute value
//   IS the payload, so this one is matched over the full tag interior
const SVG_DANGEROUS_SMIL = /attributeName\s*=\s*["']?\s*on/i;

// an svg is xml text : skip BOM / xml prolog / comments / doctype and require the
// first real element to be <svg. Sticky regexes advance an offset instead of
// re-slicing the text, so a long prolog costs one pass rather than a copy per
// construct - no sniff window is needed to keep it cheap, and a valid svg with a
// very long license/generator comment or a big inline dtd is no longer refused.
const SKIP_XML_PROLOG = [
  /\s+/y,
  /<\?xml[\s\S]*?\?>/iy,
  /<!--[\s\S]*?-->/y,
  // the internal subset must end at a ']' that is followed only by optional
  // whitespace and the closing '>'. The subset body is matched quote-aware :
  // a sequence of (non-']'/non-quote chars | double-quoted string | single-
  // quoted string), so a ']' or even a ']>' inside a quoted entity value (e.g.
  // <!ENTITY x "a]>b">) can NOT terminate the doctype early
  /<!DOCTYPE[^>[]*(?:\[(?:[^\]"']|"[^"]*"|'[^']*')*\]\s*)?>/iy
];
// the root element name may carry a `prefix:` namespace (`<svg:svg>`, as produced
// by inkscape and by xslt output) just like the dangerous element names above, and
// it may be self-closing (`<svg/>`), so '/' terminates the name too
const SVG_ROOT = /<(?:[a-z0-9]+:)?svg[\s/>]/iy;

// decode the xml text : an svg is text, so besides utf-8 (with or without BOM)
// it may be utf-16, which we can only recognise by its BOM. Both the root
// element search AND the dangerous content scan run over this decoded text, so a
// utf-16 encoded payload can't hide active content from the scan.
function decodeXml(b) {
  if (b.length >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff))) {
    // drop the BOM and a dangling odd byte (utf-16 code units are byte pairs)
    const units = b.subarray(2, 2 + (((b.length - 2) >> 1) << 1));
    // node only decodes little endian, so swap the byte pairs of a big endian
    // document on a copy first (swap16 mutates in place)
    return b[0] === 0xff ? units.toString("utf16le") : Buffer.from(units).swap16().toString("utf16le");
  }
  return b.toString("utf8");
}

// html whitespace, as the tokenizer defines it (no regex : this is called per
// character of the document)
function isSpace(c) {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
}

// walk the text and yield the interior of every markup tag, up to the matching
// '>' and quote-aware, so a '>' inside a quoted attribute value can't end a tag
// early and hide the attributes behind it. Comments and CDATA are deliberately
// NOT skipped : their content is inert, but relying on that would mean matching
// the browser's exact comment parsing (html also ends a comment on '--!>'), so
// they are scanned too - at worst a commented-out handler is refused.
//
// Each tag is yielded twice over : the full `interior`, and `outside`, the same
// interior with the CONTENT of every quoted attribute value cut out (both quotes
// themselves are kept - the closing one is where the next attribute name starts).
// An unterminated value has no closing quote, so it can only run to the end of the
// document : such a tag is never emitted by either parser, and its content stays
// 'inside'.
//
// A quote only OPENS an attribute value right after the '=' (optional whitespace
// in between), exactly like the tokenizer's before-attribute-value state. Treating
// every quote as an opener made an apostrophe in prose - `<!-- Don't edit -->`, a
// common exporter banner - open a value that never closes, so '>' stopped ending
// tags and the whole rest of the document became one "tag interior" in which a
// later text node could false-positive on the handler check. Only the '>' of a
// quoted attribute VALUE is inert, and outside such a value every '>' ends the
// tag, so this tracks the tokenizer instead of guessing.
function* markupInteriors(text) {
  let i = text.indexOf("<");
  while (i >= 0) {
    let j = i + 1;
    let quote = null;
    let afterEquals = false;
    // the pieces of the interior that are not inside a quoted value ; collected as
    // slices and joined once so this stays linear on a tag with many attributes
    const outside = [];
    let segment = i;
    while (j < text.length) {
      const c = text[j];
      if (quote) {
        if (c === quote) {
          quote = null;
          afterEquals = false;
          // the closing quote itself starts the next outside piece
          segment = j;
        }
      } else if (afterEquals && (c === '"' || c === "'")) {
        quote = c;
        outside.push(text.slice(segment, j + 1));
      } else if (c === ">") {
        break;
      } else if (c === "=") {
        afterEquals = true;
      } else if (!isSpace(c)) {
        afterEquals = false;
      }
      j++;
    }
    if (!quote) outside.push(text.slice(segment, j));
    yield { interior: text.slice(i, j), outside: outside.join("") };
    // continue after the tag : every character is visited once (the interior we
    // skip is the one we just scanned), so this stays linear on big documents
    i = text.indexOf("<", j + 1);
  }
}

function isSvg(b) {
  const text = decodeXml(b);
  let offset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (let moved = true; moved;) {
    moved = false;
    for (const re of SKIP_XML_PROLOG) {
      re.lastIndex = offset;
      const m = re.exec(text);
      // an empty match would never advance the offset : guard against looping forever
      if (m && m[0].length > 0) {
        offset = re.lastIndex;
        moved = true;
      }
    }
  }
  SVG_ROOT.lastIndex = offset;
  if (!SVG_ROOT.test(text)) return false;
  if (SVG_DANGEROUS.test(text)) return false;
  for (const tag of markupInteriors(text)) {
    if (SVG_DANGEROUS_ATTR.test(tag.outside)) return false;
    if (SVG_DANGEROUS_SMIL.test(tag.interior)) return false;
  }
  return true;
}

const SIGNATURES = [
  {
    mime: "image/png",
    check: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  },
  {
    mime: "image/jpeg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    mime: "image/gif",
    check: (b) => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.toString("latin1", 0, 6))
  },
  {
    mime: "image/webp",
    check: (b) => b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP"
  },
  {
    mime: "image/svg+xml",
    check: isSvg
  }
];

// returns the sniffed mime type, or null when the buffer is not a supported image
export function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const match = SIGNATURES.find((s) => s.check(buffer));
  return match ? match.mime : null;
}
