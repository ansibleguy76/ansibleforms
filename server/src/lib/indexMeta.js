// What the page needs from its first frame, told in index.html as meta tags (the
// Content-Security-Policy allows them, not an inline script) : the single sign-on providers that
// are on (lib/ssoMeta.js), the instance's name and its environment's label (Settings >
// Appearance). The sign-in card and the header draw them at once, instead of growing or
// changing when the api has answered. index.html is served with no-cache : a change shows at the
// next page load.

/**
 * A text made safe for an html attribute between double quotes.
 *
 * Args:
 *   value (*): the text (null or undefined : empty).
 *
 * Returns:
 *   string: with & < > " and ' as entities.
 */
export function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sets a meta tag of index.html : <meta name="<name>" content="<content>" />, replacing the one
 * already there, else in the head.
 *
 * Args:
 *   html (string): index.html.
 *   name (string): the tag's name (a fixed word of ours, not escaped).
 *   content (*): its content, escaped.
 *
 * Returns:
 *   string: index.html with the tag.
 */
export function setMeta(html, name, content) {
  if (!html) return html;
  const tag = `<meta name="${name}" content="${escapeAttribute(content)}" />`;
  const existing = new RegExp(`<meta\\s+name="${name}"[^>]*>`);
  // a function as the replacement : a $ in the content is not a replacement pattern
  if (existing.test(html)) return html.replace(existing, () => tag);
  return html.replace(/<\/head>/, () => `  ${tag}\n</head>`);
}

/**
 * Puts the instance's name and its environment's label in index.html, as /api/v2/app/config
 * gives them : af-app-name, af-env-label, af-env-label-color (empty : none).
 *
 * Args:
 *   html (string): index.html.
 *   defaults (Object|null): { appName, envLabel, envLabelColor } ; null when they could not be
 *     read : the page is left without the tags (it reads them from the api, as before).
 *
 * Returns:
 *   string: index.html with the tags.
 */
export function injectAppIdentity(html, defaults) {
  if (!html || !defaults) return html;
  let out = setMeta(html, "af-app-name", defaults.appName);
  out = setMeta(out, "af-env-label", defaults.envLabel);
  return setMeta(out, "af-env-label-color", defaults.envLabelColor);
}
