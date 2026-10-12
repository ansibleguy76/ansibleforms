import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';

/******************************************************************/
/*                                                                */
/*  Follows an output down as it comes in, as a terminal's        */
/*  `tail -f` : a running job's on the form's page after a        */
/*  submit and on the job's page, the server's log on its page.   */
/*                                                                */
/*  It follows while the reader is at the output's end : a scroll */
/*  up to read pauses it, a scroll back down to the end resumes   */
/*  it. While paused, AppFollowButton offers to jump back down -  */
/*  'New lines' once more came in. A new run starts followed.     */
/*                                                                */
/******************************************************************/

// how near the output's end counts as at its end (px) : a wheel notch short of it still follows
const NEAR_END = 120;

/**
 * The element that scrolls the page around an element : its nearest scrolling ancestor, else
 * the document's.
 *
 * Args:
 *   el (HTMLElement): the element.
 *
 * Returns:
 *   HTMLElement: what scrolls.
 */
function scrollerOf(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement || document.documentElement;
}

/**
 * The bottom of what a scroller shows, in the window's coordinates.
 *
 * Args:
 *   scroller (HTMLElement): what scrolls.
 *
 * Returns:
 *   number: its visible bottom.
 */
function viewBottom(scroller) {
  const isPage = scroller === document.scrollingElement || scroller === document.documentElement;
  return isPage ? window.innerHeight : scroller.getBoundingClientRect().bottom;
}

/**
 * Follows an output down while it is live (its job runs, the log is read).
 *
 * Args:
 *   target (Ref<HTMLElement>): the output (its panel) to keep the end of in view.
 *   size (function): what changes as the output comes in - its length, or its text.
 *   running (function): whether it is live : the job still runs ; always true for a log.
 *
 * Returns:
 *   object: { following (a ref, false while the reader scrolled up), newLines (a ref, true once
 *   more came in while paused), paused (a computed : live and scrolled up - AppFollowButton
 *   shows), jumpToEnd (a function : back to the end, following again) }.
 */
export function useFollowOutput(target, size, running) {
  const following = ref(true);
  const newLines = ref(false);
  // our own scroll : where it put the box, so its event does not pause it. A time window instead
  // (300 ms) also swallowed a reader's scroll that came within it
  let ownScroll = null;

  // the reader scrolled : following again at the output's end, paused above it. Heard in the
  // capture phase on the document, so whatever scrolls the output is heard : the box that
  // scrolls it is only known once it overflows (a log, a card body), which may come after the
  // first follow - a listener put on the box found then stayed on the window, and a quiet log
  // never showed the button
  function onScroll(e) {
    if (!target.value) return;
    const from = e?.target;
    const isPage = !from || from === document || from === document.documentElement || from === document.body;
    if (!isPage && !(from instanceof Element && from.contains(target.value))) return;
    const scroller = scrollerOf(target.value);
    if (ownScroll?.el === scroller && Math.abs(scroller.scrollTop - ownScroll.top) < 2) return;
    ownScroll = null;
    const gap = target.value.getBoundingClientRect().bottom - viewBottom(scroller);
    following.value = gap < NEAR_END;
    if (following.value) newLines.value = false;
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // the end of the output in view : the scroller moved by what hides it
  function follow() {
    if (!target.value) return;
    const scroller = scrollerOf(target.value);
    const gap = target.value.getBoundingClientRect().bottom + 16 - viewBottom(scroller);
    if (gap <= 0) return;
    scroller.scrollTop += gap;
    ownScroll = { el: scroller, top: scroller.scrollTop };
  }

  /**
   * Back to the output's end, following it again : AppFollowButton's click.
   */
  async function jumpToEnd() {
    following.value = true;
    newLines.value = false;
    await nextTick();
    follow();
  }

  // a new run : followed from its start ; an ended one a few seconds more - its status turns
  // before its last lines arrive
  let endedAt = 0;
  watch(running, (now, before) => {
    if (now && !before) {
      following.value = true;
      newLines.value = false;
    }
    if (!now && before) endedAt = Date.now();
  });
  const live = () => running() || Date.now() - endedAt < 5000;
  // more output : followed when the reader is at its end and the job runs (or just ended) ;
  // scrolled up, it says new lines came
  watch(size, async () => {
    if (!live()) return;
    if (!following.value) {
      newLines.value = true;
      return;
    }
    await nextTick();
    follow();
  });
  onBeforeUnmount(() => document.removeEventListener('scroll', onScroll, { capture: true }));

  // the button back down : while live and scrolled up (an ended job's output is only read)
  const paused = computed(() => !following.value && !!running());

  return { following, newLines, paused, jumpToEnd };
}

export default useFollowOutput;
