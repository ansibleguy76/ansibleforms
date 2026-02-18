<script setup>
import { useToast } from 'vue-toastification';
import Profile from '@/lib/Profile';
import axios from 'axios';
import settings from '@/config/settings'
import TokenStorage from '@/lib/TokenStorage';
import yaml from 'yaml';


const authenticated = ref(false);
const showTestModal = ref(false);
const currentLdap = ref(null);
const testUser = ref('');
const testPassword = ref('');
const testResult = ref(null);

function openTestModal(ldap) {
    currentLdap.value = ldap;
    testUser.value = '';
    testPassword.value = '';
    testResult.value = null;
    showTestModal.value = true;
}

function closeTestModal() {
    showTestModal.value = false;
    testUser.value = '';
    testPassword.value = '';
    testResult.value = null;
}

async function performTest() {
    if (!testUser.value || !testPassword.value) {
        toast.error("Please provide both username and password");
        return;
    }
    
    try {
        const testData = {
            ...currentLdap.value,
            testuser: testUser.value,
            testpassword: testPassword.value
        };
        const result = await axios.post(`/api/v2/ldap/check`, testData, TokenStorage.getAuthentication());
        testResult.value = result.data;
        toast.success("LDAP connection successful");
    } catch(err) {
        testResult.value = null;
        const errorMessage = err.response?.data?.error || err.message;
        const errorDetail = err.response?.data?.details || "";
        toast.error(errorDetail ? `${errorMessage}, ${errorDetail}` : errorMessage);
    }
}

const testResultYaml = computed(() => {
    if (!testResult.value) return '';
    return yaml.stringify(testResult.value);
});

onMounted(async () => {
    authenticated.value = !!(await Profile.load());
    if (!authenticated.value) {
        return;
    }
});


</script>
<template>
    <BsModal v-if="showTestModal" @close="closeTestModal">
        <template #title>
            Test LDAP Connection
        </template>
        <template #default>
            <p class="mt-3 fs-6">
                Enter test credentials to verify the LDAP connection:
            </p>
            <BsInput
                v-model="testUser"
                label="Test Username"
                type="text"
                placeholder="Enter username"
                class="mb-3"
            />
            <BsInput
                v-model="testPassword"
                label="Test Password"
                type="password"
                placeholder="Enter password"
                class="mb-3"
            />
            <div v-if="testResult" class="alert alert-success mt-3">
                <h6><faIcon icon="circle-check" class="me-2" />Connection Successful</h6>
                <div class="mt-3">
                    <strong>User Information:</strong>
                    <pre class="bg-light p-3 mt-2 rounded" style="max-height: 300px; overflow-y: auto;"><code>{{ testResultYaml }}</code></pre>
                </div>
            </div>
        </template>
        <template #footer>
            <BsButton icon="check" @click="performTest">Test</BsButton>
        </template>
    </BsModal>
    <AppNav />
    <div class="flex-shrink-0">
        <main class="d-flex flex-nowrap container-xxl">
            <AppSidebar />
            <AppAdminSingle v-if="authenticated" apiVersion="2" :settings="settings.ldap" @test="openTestModal" />
        </main>
    </div>
  
</template>
<route lang="yaml">
    meta:
      layout: settings
</route>  