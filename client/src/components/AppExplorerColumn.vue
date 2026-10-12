<script setup>
/******************************************************************/
/*                                                                */
/*  The column of a designer section's file explorer, beside its  */
/*  editor : exactly as tall as the editor's column, never        */
/*  taller - a long list scrolls inside the explorer instead of   */
/*  stretching the row and the page. Its content is laid in a    */
/*  box taken out of the flow, so it adds nothing to the row's    */
/*  height ; the explorer panel inside keeps its max-height:100%  */
/*  and scrolls its own list. On a narrow screen, where the       */
/*  explorer sits under the editor, it is back in the flow with   */
/*  a height of its own.                                          */
/*                                                                */
/*  @slots:                                                       */
/*      default: the explorer panel (.file-tree-panel)            */
/*                                                                */
/******************************************************************/
</script>

<template>
  <div class="af-explorer-column">
    <div class="af-explorer-column-fill">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.af-explorer-column {
  /* the row's height, which the editor's column alone decides */
  position: relative;
  align-self: stretch;
  min-width: 0;
  /* a short editor (an empty message) still leaves room for a few rows */
  min-height: 12rem;
}
.af-explorer-column-fill {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
/* one column (the designer's breakpoint) : the explorer under the editor, in the flow */
@media (max-width: 991.98px) {
  .af-explorer-column {
    position: static;
    align-self: start;
    min-height: 0;
  }
  .af-explorer-column-fill {
    position: static;
    max-height: 80vh;
  }
}
</style>
