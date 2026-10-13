<script setup>
/******************************************************************/
/*                                                                */
/*  A page while it loads : its title and its content's grey      */
/*  placeholders, as the page lays them out (AppSettings), from   */
/*  its address (lib/pageSkeleton.js). Beside the page's left     */
/*  menu, which the caller draws : the start-up screen            */
/*  (AppLoadingScreen), a settings page while it checks the user  */
/*  (AppSettingsPage), the jobs pages.                            */
/*                                                                */
/*  @props:                                                       */
/*      page: Object - the page's look (pageSkeleton) ; none, the */
/*            current address's                                  */
/*      delay: Number - milliseconds before the placeholders show */
/*             (AppSkeleton) ; 0 at start-up                      */
/*                                                                */
/******************************************************************/

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import BaseUrl from '@/lib/BaseUrl';
import { pageSkeleton } from '@/lib/pageSkeleton';

// INIT

const i18n = useI18n();
const store = useAppStore();

// PROPS

const props = defineProps({
  page: { type: Object, default: null },
  delay: { type: Number, default: 150 },
});

// the page's look : given, or the address's (read from the window : the router may not have
// read it yet)
const look = computed(
  () => props.page || pageSkeleton(window.location.pathname.slice(BaseUrl.length) || '/', i18n, store.profile?.options),
);
// the title as AppSettings takes it : its last step known (a title of one step), its steps
const last = computed(() => look.value?.crumbs?.at(-1) || {});
const crumbs = computed(() => (look.value?.crumbs?.length > 1 ? look.value.crumbs : []));
// a form's fields take the card's whole width (wide), the settings pages' at most 40rem
const fieldWidth = (part) => (part.wide ? { '--af-sk-field-max': 'none' } : null);
</script>

<template>
  <AppSettings
    v-if="look"
    :title="last.title || ' '"
    :icon="last.icon || 'circle'"
    :crumbs="crumbs"
    :bare="!!look.bare"
  >
    <template v-if="look.tabs" #tabs>
      <AppSkeleton shape="tabs" :count="look.tabs" :delay="delay" />
    </template>
    <template v-for="(part, i) in look.parts" :key="i">
      <!-- on a page without the card, in a card of its own -->
      <div v-if="part.card" class="card">
        <div class="card-body">
          <AppSkeleton :shape="part.shape" :count="part.count" :delay="delay" :style="fieldWidth(part)" />
        </div>
      </div>
      <AppSkeleton v-else :shape="part.shape" :count="part.count" :delay="delay" :style="fieldWidth(part)" />
    </template>
  </AppSettings>
</template>
