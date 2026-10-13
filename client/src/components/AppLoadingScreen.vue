<script setup>
/******************************************************************/
/*                                                                */
/*  The screen while the app starts                               */
/*                                                                */
/*  The header and the page to come's own frame, so the first     */
/*  frame already looks like that page rather than a bare spinner */
/*  on a white page : while the database is checked, or a single  */
/*  sign-on finishes (lib/ssoReturn.js). The header only with a   */
/*  session (or on the way back from a sign-on) : nobody signed   */
/*  in goes to the login page, which has none.                    */
/*                                                                */
/*  The page to come is read from the address (the router may    */
/*  not have read it yet) :                                       */
/*    - the forms page (the start page, after a sign-in) : its    */
/*      own frame with grey tiles (AppFormsLoading)               */
/*    - a page lib/pageSkeleton.js knows (the jobs, the settings, */
/*      a form, the profile, the designer) : its left menu, its   */
/*      title and its content's placeholders (AppPageSkeleton)    */
/*    - any other : the pages' loading indicator (AppPageLoading) */
/*  so nothing changes on screen but the content filling in.      */
/*                                                                */
/******************************************************************/

import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TokenStorage from '@/lib/TokenStorage';
import BaseUrl from '@/lib/BaseUrl';
import { ssoReturning } from '@/lib/ssoReturn';
import { useAppStore } from '@/stores/app';
import State from '@/lib/State';
import { pageSkeleton } from '@/lib/pageSkeleton';
import { statusFromSlug } from '@/lib/jobsPath';
import { profileViews, profileMenuViews } from '@/config/profileViews';
import { designerViews } from '@/config/designerViews';

// INIT

const i18n = useI18n();
const { t, locale } = i18n;
const store = useAppStore();

const hasSession = TokenStorage.isAuthenticated() || ssoReturning;
// the user of the token, as the app's start puts it on the store a moment later (State.loadProfile)
// : the header and the menus show what the user may open from the first frame
if (TokenStorage.isAuthenticated() && !store.profile) store.profile = TokenStorage.getPayload()?.user || null;
// the header's announcements, the instance's name and label, the logo : asked for now, with the
// database check, rather than after it (State.init asks again) - they come with the page instead
// of pushing it down a moment after it is drawn. Public, so harmless before the session is checked
if (hasSession) {
  State.loadAppConfig();
  State.loadLogo();
}

// ------------------------------------------------------------------
// the page to come, from the address
// ------------------------------------------------------------------
const path = window.location.pathname.slice(BaseUrl.length) || '/';
// the forms page at / and /forms/<category>
const formsMatch = path.match(/^\/(?:forms(?:\/(.*))?)?\/?$/);
const toForms = !!formsMatch;
const category = formsMatch?.[1] && formsMatch[1] !== 'all' ? decodeURIComponent(formsMatch[1]) : '';
// any other page known by its address
const look = hasSession && !toForms ? pageSkeleton(path, i18n, store.profile?.options) : null;

// ------------------------------------------------------------------
// the left menus of the pages that build their own
// ------------------------------------------------------------------
// the jobs list's status, highlighted in its menu
const jobsStatus = look?.list ? statusFromSlug(path.split('/')[2] || '') : null;
// a form : the category browsed before it, as the form's page highlights it
function browsedCategory() {
  try {
    return sessionStorage.getItem('af_forms_category');
  } catch (e) {
    return null;
  }
}
// the profile's views, the one of the address open
const profileMenu = computed(() => [
  {
    title: '',
    items: profileMenuViews(
      profileViews(t, () => store.profile?.options),
      locale.value,
    ).map((v) => ({ title: v.label(), icon: v.icon, active: v.name === look?.view, action: () => {} })),
  },
]);
// the designer's views, greyed out as until the designer is started
const designerMenu = computed(() => [
  {
    title: '',
    items: [...designerViews(t)]
      .sort((a, b) => a.label().localeCompare(b.label(), locale.value))
      .map((v) => ({ title: v.label(), icon: v.icon, disabled: true, action: () => {} })),
  },
]);
</script>

<template>
  <AppNav v-if="hasSession" />
  <AppFormsLoading v-if="hasSession && toForms" :category="category" />
  <!-- a page known by its address : its frame, its title, its placeholders -->
  <div v-else-if="look" :class="look.fill ? 'af-fill-page' : 'flex-shrink-0'">
    <main class="d-flex flex-nowrap af-settings-layout" :class="{ 'af-with-sidebar': look.fill }">
      <AppSidebar v-if="look.frame === 'settings'" />
      <AppJobsSidebar v-else-if="look.frame === 'jobs'" :jobs="[]" :loaded="false" :status="jobsStatus" />
      <AppFormsMenu v-else-if="look.frame === 'form'" class="d-none d-md-block" :currentCategory="browsedCategory()" />
      <BsSidebar
        v-else-if="look.frame === 'profile'"
        :sections="profileMenu"
        storageKey="af_profile_sidebar_collapsed"
      />
      <BsSidebar
        v-else-if="look.frame === 'designer'"
        :sections="designerMenu"
        storageKey="af_designer_sidebar_collapsed"
      />
      <AppPageSkeleton :page="look" :delay="0" />
    </main>
  </div>
  <AppPageLoading v-else />
</template>
