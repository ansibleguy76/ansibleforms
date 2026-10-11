/******************************************************************/
/*                                                                */
/*  A cron in a table cell, and what it means in words on hover : */
/*  the schedules list's Cron column (config/settings.js) and a   */
/*  user's Schedules tab (pages/admin/user.vue) show it alike.    */
/*  The popover itself opens with useCellPopovers.                */
/*                                                                */
/******************************************************************/
import i18n from '@/plugins/i18n';
import { describeCron } from '@/config/cronDescribe';

/**
 * Escapes a text for html : a cell's html goes to v-html.
 *
 * Args:
 *   s (string): the text.
 *
 * Returns:
 *   string: the text, & < > and " escaped.
 */
const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A cron in a table cell, with what it means in words in a popover (describeCron), in the
 * app's language : hovering '0 6 * * 0' says 'At 06:00 AM, only on Sunday'.
 *
 * Args:
 *   value (string): the cron expression.
 *
 * Returns:
 *   string: the cell's HTML, escaped.
 */
export function cronCell(value) {
  const words = describeCron(value, i18n.global.locale.value);
  if (!words) return escapeHtml(value ?? '');
  // the popover useCellPopovers opens on hover (data-af-popover), the look of the info popovers
  return `<span class="af-has-popover" data-af-popover="${escapeHtml(words)}">${escapeHtml(value ?? '')}</span>`;
}
