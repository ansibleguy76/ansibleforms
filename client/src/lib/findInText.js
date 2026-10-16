/******************************************************************/
/*                                                                */
/*  Finding a text in what a page shows (a job's output) : every  */
/*  place it is, whatever its case, highlighted with the CSS      */
/*  Custom Highlight API - ranges over the text as it is, so the  */
/*  page's own markup (the output's colours, rendered by Vue) is  */
/*  never touched. The highlights are styled with                 */
/*  ::highlight(af-find) and ::highlight(af-find-current)         */
/*  (styles/bootstrap-override.scss).                             */
/*                                                                */
/******************************************************************/

/**
 * Every place a text is in some elements, as ranges : searched in each element's own text (a
 * line), its parts in different nodes (coloured spans) put together.
 *
 * Args:
 *   elements (Element[]): where to search, one by one (a line each).
 *   query (string): the text ; matched whatever its case.
 *
 * Returns:
 *   Range[]: the places, in the order they are shown.
 */
export function findRanges(elements, query) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const ranges = [];
  for (const el of elements) {
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let text = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      nodes.push({ node: n, start: text.length });
      text += n.nodeValue;
    }
    const lower = text.toLowerCase();
    // the node and the offset in it of a position in the line's text
    const at = (pos) => {
      let i = nodes.length - 1;
      while (i > 0 && nodes[i].start > pos) i--;
      return [nodes[i].node, pos - nodes[i].start];
    };
    for (let from = lower.indexOf(q); from !== -1; from = lower.indexOf(q, from + q.length)) {
      const range = document.createRange();
      range.setStart(...at(from));
      range.setEnd(...at(from + q.length));
      ranges.push(range);
    }
  }
  return ranges;
}

const supported = () => typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';

/**
 * Highlights the places found, one of them as the current one, and brings it into view.
 *
 * Args:
 *   ranges (Range[]): the places (findRanges).
 *   current (number): the one in view ; -1 for none.
 *   scroll (boolean): bring it into view (not when the text only grew under it).
 */
export function showRanges(ranges, current = -1, scroll = true) {
  if (supported()) {
    CSS.highlights.set('af-find', new Highlight(...ranges));
    if (ranges[current]) CSS.highlights.set('af-find-current', new Highlight(ranges[current]));
    else CSS.highlights.delete('af-find-current');
  }
  const el = scroll ? ranges[current]?.startContainer?.parentElement : null;
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Takes the highlights away.
 */
export function clearRanges() {
  if (!supported()) return;
  CSS.highlights.delete('af-find');
  CSS.highlights.delete('af-find-current');
}
