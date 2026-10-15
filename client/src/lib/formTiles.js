/******************************************************************/
/*                                                                */
/*  How many grey tiles the forms page shows while it loads : as  */
/*  many as fill its grid, columns by rows. The grid's columns    */
/*  follow Bootstrap's breakpoints (col-md-6 col-lg-4 col-xxl-3 : */
/*  1, 2, 3 or 4) ; 3 rows, 5 on the widest screens - a laptop 9  */
/*  tiles, a big screen 20. The start-up screen                   */
/*  (AppFormsLoading) and the page (pages/index.vue) use the same */
/*  count, so the placeholders do not change between the two.    */
/*                                                                */
/******************************************************************/
import { ref, onMounted, onBeforeUnmount } from 'vue';

/**
 * The columns of the forms grid at a window width.
 *
 * Args:
 *   width (number): the window's width, in px.
 *
 * Returns:
 *   number: 1 to 4.
 */
export function tileColumns(width) {
  if (width >= 1400) return 4;
  if (width >= 992) return 3;
  if (width >= 768) return 2;
  return 1;
}

/**
 * The placeholders that fill the forms grid at a window width : its columns by 3 rows, 5 rows on the
 * widest screens.
 *
 * Args:
 *   width (number): the window's width, in px.
 *
 * Returns:
 *   number: the tiles.
 */
export function tileCount(width) {
  const columns = tileColumns(width);
  return columns * (columns >= 4 ? 5 : 3);
}

/**
 * The placeholders for this window, kept up to date when it is resized.
 *
 * Returns:
 *   Ref<number>: the tiles.
 */
export function useTileCount() {
  const width = () => (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const count = ref(tileCount(width()));
  const resize = () => {
    count.value = tileCount(width());
  };
  onMounted(() => window.addEventListener('resize', resize, { passive: true }));
  onBeforeUnmount(() => window.removeEventListener('resize', resize));
  return count;
}

export default { tileColumns, tileCount, useTileCount };
