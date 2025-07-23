<script setup>
import { ref, onMounted, computed } from "vue";
import axios from "axios";
import Profile from "@/lib/Profile";
import settings from "@/config/settings";
import { useToast } from "vue-toastification";
import TokenStorage from "@/lib/TokenStorage";

const authenticated = ref(false);
const toast = useToast();
const config = ref({});

onMounted(async () => {
    try {
        const result = await axios.get(`/api/v1/settings`, TokenStorage.getAuthentication());
        config.value = result.data.data.output;
    } catch (err) {
        console.log("Error loading settings");
        toast.error(err.message);
    }
});

const callbackUrl = computed(() => {
    return `${config.value.url || "https://**************"}/api/v1/auth/oidc/callback`
})

onMounted(async () => {
    authenticated.value = !!(await Profile.load());
    if (!authenticated.value) {
        return;
    }
});


</script>
<template>
    <AppNav />
    <div class="flex-shrink-0">
        <main class="d-flex flex-nowrap container-xxl">
            <AppSidebar />
            <AppAdminSingle v-if="authenticated" :settings="settings.openId">
                <div class="alert alert-info">
                    <p><strong>Callback Url </strong>: {{ callbackUrl }} <span v-if="!config.url" class="tag is-danger"><font-awesome-icon icon="circle-exclamation" class="mr-1" /> You have not set the Ansible Form Url (see: 'General > Ansible Forms' settings page)</span></p>
                </div>
            </AppAdminSingle>
        </main>
    </div>
</template>
