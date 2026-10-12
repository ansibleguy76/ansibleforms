import { ref, watch } from 'vue';

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

// ─── folded away ──────────────────────────────────────────────────────────────

// remembered in the browser, so every section opens as the last one was left
const FOLDED_KEY = 'af.designer.explorerFolded';
function readFolded() {
  try {
    return localStorage.getItem(FOLDED_KEY) === '1';
  } catch {
    return false;
  }
}

/** The explorer folded away (its > in its header) : the editor takes the width, a < brings it back. */
export const explorerFolded = ref(readFolded());
watch(explorerFolded, (folded) => {
  try {
    localStorage.setItem(FOLDED_KEY, folded ? '1' : '0');
  } catch {
    // a browser that keeps nothing : folded until the page reloads
  }
});

/**
 * The columns of an editor with its explorer : the editor, the handle and the explorer at its
 * width ; folded, only the explorer's < remains.
 *
 * Args:
 *   pct (number): the explorer's width, in percent.
 *
 * Returns:
 *   string: the grid's template columns.
 */
export function explorerColumns(pct) {
  return explorerFolded.value ? '1fr 0.5rem 2.25rem' : `1fr 1rem ${pct}%`;
}
