<script setup>
import { ref, onMounted, computed } from "vue";
import Profile from "@/lib/Profile";
import axios from "axios";
import settings from "@/config/settings";
import { useToast } from "vue-toastification";
import TokenStorage from "@/lib/TokenStorage";

const toast = useToast();
const config = ref({});
const authenticated = ref(false);

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
    return `${config.value.url || "https://**************"}/api/v1/auth/azureadoauth2/callback`
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
            <AppAdminSingle v-if="authenticated" :settings="settings.entraId">
                <div class="alert alert-info">
                    <strong>Required API Permissions</strong><br>
                    <ul>
                        <li>Delegated User.Read</li>
                        <li>Delegated GroupMember.Read.All</li>
                    </ul>
                    <strong>Required Group Claims</strong>
                    <ul>
                        <li>Security Groups</li>
                        <li>Access > samAccountName</li>
                    </ul>
                    <p><strong>Callback Url </strong>: {{ callbackUrl }} <span v-if="!config.url" class="tag is-danger"><font-awesome-icon icon="circle-exclamation" class="mr-1" /> You have not set the Ansible Form Url (see: 'General > Ansible Forms' settings page)</span></p>
                </div>
            </AppAdminSingle>
        </main>
    </div>
</template>
