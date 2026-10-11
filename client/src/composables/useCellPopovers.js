/******************************************************************/
/*                                                                */
/*  Hover popovers for table cells. A cell's html cannot hold a   */
/*  component : a cell that has more to say marks an element     */
/*  with data-af-popover, and hovering it opens that text in the  */
/*  app's popover (the look of the page title's info popover).    */
/*  Created on the first hover, so a table of a thousand rows     */
/*  makes none until one is needed ; disposed with the page.      */
/*                                                                */
/******************************************************************/
import { onBeforeUnmount } from 'vue';
import { Popover } from 'bootstrap';
import { disposeWhenHidden } from '@/lib/popoverDispose';

/**
 * The hover handler for a table : put it on the table's mouseover.
 *
 * Returns:
 *   object: { onCellHover } - opens the popover of the element hovered, when it has one.
 */
export function useCellPopovers() {
  // each with the element it is attached to, for disposeWhenHidden
  const cellPopovers = new Map();

  /**
   * Opens the popover of the element hovered, when it has one (data-af-popover).
   *
   * Args:
   *   event (MouseEvent): a mouseover in the table.
   */
  function onCellHover(event) {
    const el = event.target?.closest?.('[data-af-popover]');
    if (!el || Popover.getInstance(el)) return;
    const popover = new Popover(el, {
      content: el.getAttribute('data-af-popover'),
      trigger: 'hover focus',
      placement: 'top',
      // the text as text, never as html
      html: false,
      customClass: 'af-info-popover',
    });
    cellPopovers.set(popover, el);
    popover.show();
  }

  onBeforeUnmount(() => {
    // the table's rows go with the page : their popovers too, the one under the mouse after its
    // fade (lib/popoverDispose.js)
    for (const [popover, el] of cellPopovers) disposeWhenHidden(popover, el);
    cellPopovers.clear();
  });

  return { onCellHover };
}
