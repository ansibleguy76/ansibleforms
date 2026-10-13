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
/*  none.                                                         */
/*                                                                */
/******************************************************************/

import TokenStorage from '@/lib/TokenStorage';
import { ssoReturning } from '@/lib/ssoReturn';

const hasSession = TokenStorage.isAuthenticated() || ssoReturning;
</script>

<template>
  <AppNav v-if="hasSession" />
  <AppPageLoading />
</template>
