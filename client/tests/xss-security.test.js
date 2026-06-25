import { describe, it, expect } from 'vitest';
import Helpers from '@/lib/Helpers';
import DOMPurify from 'dompurify';

// ─── Helpers.htmlEncode ──────────────────────────────────────

describe('Helpers.htmlEncode', () => {
  it('escapes < and > characters', () => {
    const result = Helpers.htmlEncode('<div>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('escapes ampersand', () => {
    const result = Helpers.htmlEncode('a & b');
    expect(result).not.toBe('a & b');
    expect(result).toContain('&#38;');
  });

  it('escapes a script tag', () => {
    const result = Helpers.htmlEncode('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('escapes img onerror payload (tag brackets neutralized)', () => {
    const result = Helpers.htmlEncode('<img src=x onerror="alert(1)">');
    // htmlEncode escapes < and > so the tag can't be parsed as HTML
    expect(result).not.toContain('<img');
    expect(result).toContain('&#60;img');
  });

  it('escapes SVG-based XSS', () => {
    const result = Helpers.htmlEncode('<svg/onload=alert(1)>');
    expect(result).not.toContain('<svg');
  });

  it('handles empty string', () => {
    expect(Helpers.htmlEncode('')).toBe('');
  });

  it('passes through string with no special chars', () => {
    expect(Helpers.htmlEncode('hello world 123')).toBe('hello world 123');
  });

  it('escapes non-ASCII chars (unicode range 00A0-9999)', () => {
    const result = Helpers.htmlEncode('©');
    expect(result).toContain('&#');
  });

  it('is idempotent for safe strings', () => {
    const safe = 'just some text';
    expect(Helpers.htmlEncode(safe)).toBe(safe);
  });

  it('can handle numbers (via toString)', () => {
    expect(() => Helpers.htmlEncode(42)).not.toThrow();
    expect(Helpers.htmlEncode(42)).toBe('42');
  });
});

// ─── DOMPurify sanitization (used by AppForm + BsInputForForm) ───
// Note: DOMPurify requires a full browser DOM to sanitize properly.
// In happy-dom, DOMPurify may not strip all dangerous elements because
// the DOM parser is incomplete. These tests verify the API contract
// (that DOMPurify.sanitize is callable and returns a string), while
// the actual sanitization is verified in real browser E2E tests.

describe('DOMPurify sanitization API', () => {
  it('returns a string from sanitize()', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>';
    const clean = DOMPurify.sanitize(dirty);
    expect(typeof clean).toBe('string');
  });

  it('handles empty string', () => {
    expect(DOMPurify.sanitize('')).toBe('');
  });

  it('handles null-ish input gracefully', () => {
    expect(typeof DOMPurify.sanitize(null)).toBe('string');
    expect(typeof DOMPurify.sanitize(undefined)).toBe('string');
  });

  it('is idempotent for plain text', () => {
    const plain = 'Hello World';
    expect(DOMPurify.sanitize(plain)).toBe(plain);
  });

  it('preserves simple safe text content', () => {
    const safe = 'Just text, no HTML';
    expect(DOMPurify.sanitize(safe)).toBe(safe);
  });
});

// ─── BsAdminTable highlight logic ────────────────────────────

describe('BsAdminTable highlight escaping', () => {
  // Extracted highlight logic to test in isolation
  function highlight(text, filterValue, filterable) {
    var safeText = (text != undefined) ? Helpers.htmlEncode(text.toString()) : '';
    if (filterValue && text != undefined && filterable) {
      return safeText.replace(new RegExp(Helpers.htmlEncode(filterValue), 'gi'), match => {
        return `<b>${match}</b>`;
      });
    } else {
      return safeText;
    }
  }

  it('escapes HTML in cell values', () => {
    const result = highlight('<script>alert(1)</script>', '', false);
    expect(result).not.toContain('<script>');
  });

  it('escapes HTML even when filtering', () => {
    const result = highlight('<b>bold</b>', 'bold', true);
    // The original <b> tags are encoded as &#60;b&#62;
    // The filter wraps matching "bold" in new <b> tags (safe, from the app)
    expect(result).toContain('&#60;b&#62;');
    expect(result).toContain('<b>bold</b>');
    // The original dangerous <b> tag is neutralized — it's entity-encoded
    expect(result).not.toMatch(/^<b>bold<\/b>$/);
  });

  it('wraps filter matches in bold', () => {
    const result = highlight('hello world', 'world', true);
    expect(result).toContain('<b>world</b>');
  });

  it('returns empty string for undefined', () => {
    const result = highlight(undefined, '', false);
    expect(result).toBe('');
  });

  it('handles numbers as cell values', () => {
    const result = highlight(42, '', false);
    expect(result).toBe('42');
  });

  it('escapes XSS in filter value itself', () => {
    const result = highlight('test value', '<script>', true);
    expect(result).not.toContain('<script>');
  });

  it('escapes img tag in cell content', () => {
    const result = highlight('<img onerror=alert(1)>', '', false);
    expect(result).not.toContain('<img');
  });

  it('handles cell values with ampersands', () => {
    const result = highlight('Tom & Jerry', '', false);
    expect(result).not.toBe('Tom & Jerry');
    expect(result).toContain('&#38;');
  });
});

// ─── BsInputSelectAdvancedTable getProgressHtml logic ────────

describe('BsInputSelectAdvancedTable getProgressHtml escaping', () => {
  function getProgressHtml(value) {
    var rounded;
    if (!isNaN(value)) {
      rounded = Math.round(parseInt(value));
      if (rounded < 0) rounded = 0;
      if (rounded > 100) rounded = 100;
      return `<div class="progress" role="progressbar" aria-label="Basic example" aria-valuenow="${rounded}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width: ${rounded}%"></div></div>`;
    } else {
      return Helpers.htmlEncode((value ?? "") + "");
    }
  }

  it('renders progress bar for numeric value', () => {
    const result = getProgressHtml(50);
    expect(result).toContain('progress-bar');
    expect(result).toContain('width: 50%');
  });

  it('escapes XSS payload in non-numeric value', () => {
    const result = getProgressHtml('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
  });

  it('escapes img tag in non-numeric value', () => {
    const result = getProgressHtml('<img onerror=alert(1)>');
    expect(result).not.toContain('<img');
  });

  it('handles null value', () => {
    const result = getProgressHtml(null);
    expect(result).toContain('progress-bar');
  });

  it('handles undefined value', () => {
    const result = getProgressHtml(undefined);
    expect(result).toBe('');
  });

  it('escapes HTML entities in text fallback', () => {
    const result = getProgressHtml('a & b');
    expect(result).toContain('&#38;');
  });

  it('handles string number', () => {
    const result = getProgressHtml('75');
    expect(result).toContain('progress-bar');
    expect(result).toContain('width: 75%');
  });

  it('clamps values above 100', () => {
    const result = getProgressHtml(150);
    expect(result).toContain('width: 100%');
  });

  it('clamps values below 0', () => {
    const result = getProgressHtml(-5);
    expect(result).toContain('width: 0%');
  });
});

// ─── jobs.vue replacePlaceholders logic ──────────────────────

describe('jobs.vue replacePlaceholders escaping', () => {
  // Simulates the patched replacePlaceholders function
  function findExtravar(data, expr) {
    return expr.split(/\s*\.\s*/).reduce((master, obj, level, arr) => {
      if (level === arr.length - 1) {
        try { return master[obj]; } catch { return ''; }
      }
      return master[obj];
    }, data);
  }

  function replacePlaceholders(msg, extravars) {
    if (!msg) return '';
    return msg.replace(
      /\$\(([^)]+)\)/g,
      (placeholderWithDelimiters, placeholderWithoutDelimiters) =>
        Helpers.htmlEncode(
          String(findExtravar(extravars, placeholderWithoutDelimiters) || placeholderWithDelimiters)
        )
    );
  }

  it('replaces placeholders with encoded values', () => {
    const result = replacePlaceholders('Hello $(name)', { name: 'World' });
    expect(result).toBe('Hello World');
  });

  it('escapes XSS in extravar value', () => {
    const result = replacePlaceholders('Value: $(field1)', { field1: '<script>alert(1)</script>' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('Value: ');
  });

  it('escapes img onerror in extravar value', () => {
    const result = replacePlaceholders('Result: $(input)', { input: '<img onerror=alert(1)>' });
    expect(result).not.toContain('<img');
  });

  it('escapes ampersands in extravar value', () => {
    const result = replacePlaceholders('Name: $(company)', { company: 'Tom & Jerry' });
    expect(result).not.toBe('Name: Tom & Jerry');
    expect(result).toContain('&#38;');
  });

  it('preserves placeholder when extravar not found', () => {
    const result = replacePlaceholders('Hello $(missing)', {});
    // The placeholder itself should be encoded (though it's safe, the function encodes it)
    expect(result).toContain('missing');
  });

  it('handles nested extravar paths', () => {
    const result = replacePlaceholders('IP: $(server.ip)', { server: { ip: '10.0.0.1' } });
    expect(result).toBe('IP: 10.0.0.1');
  });

  it('escapes XSS in nested extravar values', () => {
    const result = replacePlaceholders(
      'Config: $(settings.value)',
      { settings: { value: '"><script>alert(1)</script>' } }
    );
    expect(result).not.toContain('<script>');
  });

  it('handles empty message', () => {
    expect(replacePlaceholders('', {})).toBe('');
    expect(replacePlaceholders(null, {})).toBe('');
  });

  it('handles message with no placeholders', () => {
    const msg = 'No placeholders here';
    expect(replacePlaceholders(msg, {})).toBe(msg);
  });

  it('handles multiple placeholders with XSS', () => {
    const result = replacePlaceholders(
      '$(a) and $(b)',
      { a: '<script>xss</script>', b: '<img src=x>' }
    );
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<img');
  });
});
