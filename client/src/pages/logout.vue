<script setup>

import State from "@/lib/State";
import axios from "axios";
import { useAppStore } from "@/stores/app";
import { useToast } from "vue-toastification";
import { useRoute, useRouter } from "vue-router";
import TokenStorage from "@/lib/TokenStorage";
import Navigate from "@/lib/Navigate";

const store = useAppStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();


// redirect to login page if not oidc
var userType = store.profile?.type || "local"

// clear all authentication states
TokenStorage.clear()

// this.formConfig=undefined // TODO clear formConfig
State.refreshAuthenticated()
State.loadProfile()

if (userType == "local" || userType == "ldap" || userType == "azuread") {
    Navigate.toLogin(router, route)
}

if (userType == "oidc") {
  axios.get(`/api/v1/auth/logout`).then((res) => {
      const logoutUrl = res?.data?.data?.output?.logoutUrl;
      if (logoutUrl) {
        // Go to Keycloak end-session endpoint
        location.replace(logoutUrl);
      } else {
        // If no IdP logout URL, at least go back to login
        Navigate.toLogin(router, route);
      }
    }).catch((err) => {
      console.log(err)
      toast.error("Could not log out");
      // fallback: go to login anyway
      Navigate.toLogin(router, route);
    })
}
</script>
<template>
    <div class="d-flex align-items-center py-4 bg-body-tertiary login vh-100">
        <div class="d-flex justify-content-center">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Logging out...</span>
            </div>
        </div>
    </div>

</template>
<style scoped lang="scss">
[data-bs-theme="light"] {
    .login {
        background-image: url(/img/login_background_light.jpg) !important;
        background-size: cover;
    }
}

[data-bs-theme="dark"] {
    .login {
        background-image: url(/img/login_background_dark.jpg) !important;
        background-size: cover;
    }
}

[data-bs-theme="color"] {
    .login {
        background-image: url(/img/login_background_color.jpg) !important;
        background-size: cover;
    }
}
</style>
