<script setup>
import State from '@/lib/State';
import axios from 'axios';
import { useAppStore } from '@/stores/app';
import { toast } from 'vue-sonner';
import { useRoute, useRouter } from 'vue-router';
import TokenStorage from '@/lib/TokenStorage';
import { forgetMenus } from '@/lib/menuMemory';
import Navigate from '@/lib/Navigate';
import { rememberedSso } from '@/lib/loginSso';

const store = useAppStore();
// the single sign-on buttons the login card had last time : their room kept (lib/loginSso.js)
const lastSso = rememberedSso();

const route = useRoute();
const router = useRouter();

// redirect to login page if not oidc
var userType = store.profile?.type || 'local';

// the server ends this session : its access token and refresh token stop working at once, not
// when they expire (server/src/lib/tokenRevocation.js). Fire and forget : the logout goes on
// whatever the answer.
// just signed out : the login page stays in this tab, rather than Skip the login page sending them
// back to the provider, whose session would sign them in again (pages/login.vue)
try {
  sessionStorage.setItem('af_signed_out', '1');
} catch {
  // no storage (a private window) : the login page may go to the provider
}
if (TokenStorage.getToken()) {
  axios.post(`/api/v2/auth/logout`, { refreshtoken: TokenStorage.getRefreshToken() }).catch(() => {});
}

// For OIDC, get logout URL first before clearing tokens
if (userType == 'oidc') {
  axios
    .get(`/api/v2/auth/logout`)
    .then((res) => {
      // clear all authentication states AFTER getting logout URL
      TokenStorage.clear();
      forgetMenus();
      State.refreshAuthenticated();
      State.loadProfile();

      const logoutUrl = res?.data?.logoutUrl;
      if (logoutUrl) {
        // Go to Keycloak end-session endpoint
        location.replace(logoutUrl);
      } else {
        // If no IdP logout URL, at least go back to login
        Navigate.toLogin(router, route);
      }
    })
    .catch((err) => {
      console.log(err);
      // Clear tokens even on error
      TokenStorage.clear();
      forgetMenus();
      State.refreshAuthenticated();
      State.loadProfile();
      toast.error('Could not log out');
      // fallback: go to login anyway
      Navigate.toLogin(router, route);
    });
} else {
  // For local/ldap/azuread, clear tokens immediately
  TokenStorage.clear();
  forgetMenus();
  State.refreshAuthenticated();
  State.loadProfile();
  Navigate.toLogin(router, route);
}
</script>
<template>
  <!-- the sign-in card that comes next, its form as grey placeholders : the login page then draws
       its own card in the same spot (AppLoginFrame) -->
  <AppLoginFrame>
    <AppSkeleton shape="login" :count="lastSso" :delay="0" />
  </AppLoginFrame>
</template>
