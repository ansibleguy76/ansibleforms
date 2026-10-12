// The designer's file explorer (Forms, Playbooks, Vars files, Inventories) : how wide it opens
// beside the editor, and how far its handle drags it, in percent of the section's width.
export const EXPLORER_WIDTH = { start: 30, min: 15, max: 50 };

/**
 * The explorer's width once its handle moved : the width it started at, less what the handle
 * moved (dragged left, wider), kept between min and max.
 *
 * Args:
 *   startPct (number): the width when the drag started, in percent.
 *   movedPx (number): how far the handle moved, in pixels (to the right is positive).
 *   widthPx (number): the section's width, in pixels.
 *
 * Returns:
 *   number: the new width, in percent.
 */
export function explorerWidthAfterDrag(startPct, movedPx, widthPx) {
  return Math.min(EXPLORER_WIDTH.max, Math.max(EXPLORER_WIDTH.min, startPct - (movedPx / widthPx) * 100));
}
