/******************************************************************/
/*                                                                */
/*  AnsibleForms HTML sanitizer                                   */
/*                                                                */
/*  The single policy for form-authored HTML that reaches         */
/*  v-html : `type: html` fields (AppForm) and `type: expression` */
/*  fields rendered as html (BsInputForForm). Both went through   */
/*  a bare DOMPurify.sanitize() before ; they share this module   */
/*  so the policy cannot drift between them.                      */
/*                                                                */
/******************************************************************/

import DOMPurify from 'dompurify';

// DOMPurify 3.x does not carry `target` in its default attribute allowlist, so a link
// written as <a href="..." target="_blank"> lost the attribute and opened in the current
// tab - throwing away the form the user was filling in (issue #480). It is allowed back
// here, and nothing else is widened : `onclick` and every other event handler is still
// refused, and a javascript: href is still dropped even on a link that carries a target.
export const ADD_ATTR = ['target'];

// A target other than _self opens a new browsing context, and the page that lands there
// can steer its opener through window.opener unless rel says otherwise. Browsers imply
// noopener for target="_blank" these days but not for a named target, and the form author
// cannot be relied on to write the rel - so it is forced on rather than expected.
export function forceSafeRel(node) {
  if (typeof node?.getAttribute !== 'function') return; // text/comment nodes
  const target = node.getAttribute('target');
  if (!target || target === '_self') return;
  const rel = new Set((node.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
  rel.add('noopener');
  rel.add('noreferrer');
  node.setAttribute('rel', [...rel].join(' '));
}

DOMPurify.addHook('afterSanitizeAttributes', forceSafeRel);

export function sanitize(html) {
  return DOMPurify.sanitize(html || '', { ADD_ATTR });
}

export default { sanitize, forceSafeRel, ADD_ATTR };
