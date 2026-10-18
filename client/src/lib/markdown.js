/******************************************************************/
/*                                                                */
/*  AnsibleForms markdown rendering                               */
/*                                                                */
/*  The one way form-provided markdown (a form's help, a wizard   */
/*  step's help) becomes HTML : showdown with the github flavour  */
/*  the forms' help was always written for, then the app's single */
/*  HTML policy (HtmlSanitizer). <vue-showdown> rendered its      */
/*  output unsanitized, so a form author's markdown could carry   */
/*  raw <script>/<img onerror> into every viewer's page.          */
/*                                                                */
/******************************************************************/

import showdown from 'showdown';
import { sanitize } from '@/lib/HtmlSanitizer';

// github flavour with fenced code blocks : what <vue-showdown flavor="github"> applied
const converter = new showdown.Converter({ ghCodeBlocks: true });
converter.setFlavor('github');

/**
 * Render markdown to sanitized HTML, ready for v-html.
 *
 * Args:
 *   text (string): the markdown; anything else is stringified, null/undefined is empty.
 *
 * Returns:
 *   string: HTML that went through HtmlSanitizer.sanitize.
 */
export function renderMarkdown(text) {
  return sanitize(converter.makeHtml(String(text ?? '')));
}

export default { renderMarkdown };
