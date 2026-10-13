<script setup>
/******************************************************************/
/*                                                                */
/*  The screen while the app starts                               */
/*                                                                */
/*  The header and the pages' loading indicator (AppPageLoading), */
/*  so the first frame already looks like the page to come rather */
/*  than a bare spinner on a white page : while the database is   */
/*  checked, or a single sign-on finishes (lib/ssoReturn.js).     */
/*  The header only with a session (or on the way back from a     */
/*  sign-on) : nobody signed in goes to the login page, which has */
/*  none. On the way to the forms page (the start page, after a   */
/*  sign-in) its own frame with grey tiles (AppFormsLoading), so  */
/*  nothing changes on screen but the tiles filling in.           */
/*                                                                */
/******************************************************************/

import TokenStorage from '@/lib/TokenStorage';
import BaseUrl from '@/lib/BaseUrl';
import { ssoReturning } from '@/lib/ssoReturn';

const hasSession = TokenStorage.isAuthenticated() || ssoReturning;
// the page to come, from the address (the router may not have read it yet) : the forms page at
// / and /forms/<category>
const path = window.location.pathname.slice(BaseUrl.length) || '/';
const formsMatch = path.match(/^\/(?:forms(?:\/(.*))?)?\/?$/);
const toForms = !!formsMatch;
const category = formsMatch?.[1] && formsMatch[1] !== 'all' ? decodeURIComponent(formsMatch[1]) : '';
</script>

<template>
  <AppNav v-if="hasSession" />
  <AppFormsLoading v-if="hasSession && toForms" :category="category" />
  <AppPageLoading v-else />
</template>
