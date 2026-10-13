<script setup>
/******************************************************************/
/*                                                                */
/*  App AnsibleForms Settings Sidebar menu                        */
/*                                                                */
/*  Every entry carries the role option its PAGE requires, and    */
/*  the menu is filtered on it. Keep that field in step with the  */
/*  route's `beforeEnter` guard in router/index.js - if the two   */
/*  disagree the menu offers a link that bounces the user back    */
/*  home, which has happened twice in this codebase.              */
/*                                                                */
/*  It matters because the guards are NOT uniform : showSettings  */
/*  covers most pages, while backups and the server log each      */
/*  have their own option. Filtering per item means an unusable   */
/*  link cannot be rendered, rather than relying on someone       */
/*  remembering to wrap a section by hand.                        */
/*                                                                */
/*  The scheduled and stored jobs are in the jobs menu            */
/*  (AppJobsSidebar), which follows the same rule.                */
/*                                                                */
/******************************************************************/

import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { mayOpen } from '@/lib/routePermission';
import { settingsMenu } from '@/lib/settingsMenu';

const { t } = useI18n();
const store = useAppStore();

// an item shows when the user may open its link : the role option of its route
// (lib/routePermission.js), never restated here

const sections = computed(() =>
  settingsMenu(t)
    .map((s) => ({ ...s, items: s.items.filter((i) => mayOpen(i.link, store.profile?.options)) }))
    .filter((s) => s.items.length > 0),
);
</script>
<template>
  <BsSidebar :sections="sections" />
</template>
<style scoped></style>
