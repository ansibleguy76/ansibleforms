<script setup>
/******************************************************************/
/*                                                                */
/*  The forms page while it loads, before it runs                 */
/*                                                                */
/*  The forms page's own frame - the forms menu, the title, the   */
/*  tiles as grey placeholders (AppSkeleton) - for the app's      */
/*  start-up screen (AppLoadingScreen) when the page to come is   */
/*  the forms page : a sign-in, a single sign-on's way back or a  */
/*  reload lands there with nothing on screen changing but the    */
/*  tiles filling in.                                             */
/*                                                                */
/*  @props:                                                       */
/*      category: String - the category of the address (empty :  */
/*                all the forms) : its title once the forms load  */
/*                                                                */
/******************************************************************/

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { sectionOf } from '@/lib/sections';

// INIT

const { t } = useI18n();

// PROPS

const props = defineProps({
  category: { type: String, default: '' },
});

// the title as the forms page puts it : "All forms" ; a category's address only carries its slug,
// its name is known once the forms are, so a grey bar in its place meanwhile
const title = computed(() => (props.category ? null : { title: t('forms.allForms'), icon: 'list' }));
// its steps as the page will show them ("Forms › All forms") : the router may not have read the
// address yet, so the section is named here rather than taken from the route
const crumbs = computed(() => [
  sectionOf('/forms/all', t),
  { title: t('forms.allForms'), icon: 'list', to: '/forms/all' },
]);
</script>

<template>
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap af-settings-layout">
      <div class="w-100 d-flex flex-column">
        <div class="row g-0 flex-grow-1 flex-md-nowrap af-forms-row">
          <AppFormsMenu :currentCategory="category" />
          <div class="col h-100 bg-body">
            <AppSettings
              v-if="title"
              bare
              :title="title.title"
              :icon="title.icon"
              :crumbs="crumbs"
              :description="t('forms.pageDescription')"
            >
              <AppSkeleton shape="tiles" :count="8" />
            </AppSettings>
            <AppSettings v-else bare title=" " icon="folder">
              <AppSkeleton shape="tiles" :count="8" />
            </AppSettings>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
