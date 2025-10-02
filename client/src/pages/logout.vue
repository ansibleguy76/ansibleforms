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

// clear all authentication states
TokenStorage.clear()

// this.formConfig=undefined // TODO clear formConfig
State.refreshAuthenticated()
State.loadProfile()

// redirect to login page if not oidc
var userType = store.profile?.type || "local"
if (userType == "local" || userType == "ldap" || userType == "azuread") {
    Navigate.toLogin(router, route)
}

// logout from oidc
if (userType == "oidc") {
    axios.get(`/api/v1/auth/logout`).then((res) => {
        const logoutUrl = res.data?.data?.output?.logoutUrl
        if (logoutUrl) {
            location.replace(logoutUrl)
        }
    }).catch((err) => {
        console.log(err)
        toast.error("Could not log out")
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
        background-image: url(@/assets/img/login_background_light.jpg) !important;
        background-size: cover;
    }
}

[data-bs-theme="dark"] {
    .login {
        background-image: url(@/assets/img/login_background_dark.jpg) !important;
        background-size: cover;
    }
}

[data-bs-theme="color"] {
    .login {
        background-image: url(@/assets/img/login_background_color.jpg) !important;
        background-size: cover;
    }
}
</style>
