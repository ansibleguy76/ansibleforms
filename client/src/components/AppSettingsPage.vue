<script setup>
/******************************************************************/
/*                                                                */
/*  The frame of a settings page : the header, then the settings  */
/*  sidebar beside the page's own content (the default slot).     */
/*  Every page under Settings used to repeat it.                  */
/*                                                                */
/*  While the page shows nothing yet (it checks the user first,   */
/*  `v-if="authenticated"`), its title and its content's grey     */
/*  placeholders from its address (AppPageSkeleton) : the page    */
/*  then draws itself in the same spot.                           */
/*                                                                */
/*  @props:                                                       */
/*      withSidebar: Boolean - af-with-sidebar on main (a page    */
/*        that scrolls its own pane, the logs)                    */
/*                                                                */
/******************************************************************/
import { Comment, Fragment, useSlots } from 'vue';

defineProps({
  withSidebar: { type: Boolean, default: false },
});

const slots = useSlots();

/**
 * Whether nodes render nothing : comments only (a v-if not met), or fragments of those.
 *
 * Args:
 *   nodes (Array): vnodes.
 *
 * Returns:
 *   boolean: true when nothing would show.
 */
function nothingIn(nodes) {
  return (nodes || []).every(
    (n) => n.type === Comment || (n.type === Fragment && Array.isArray(n.children) && nothingIn(n.children)),
  );
}
// read at every render : the slot's conditions are the page's, followed as they change
const pageEmpty = () => nothingIn(slots.default?.());
</script>
<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap af-settings-layout" :class="{ 'af-with-sidebar': withSidebar }">
      <AppSidebar />
      <slot></slot>
      <!-- the page not drawn yet : its title and placeholders where it comes -->
      <AppPageSkeleton v-if="pageEmpty()" />
    </main>
  </div>
</template>
