<script setup>
import Profile from '@/lib/Profile';
import settings from '@/config/settings';
import YAML from 'yaml';

const adminMulti = ref(null);
const authenticated = ref(false);
const currentStoredJob = ref(null);
const showStoredJobDetails = ref(false);

const formDataYaml = computed(() => {
    if (!currentStoredJob.value?.form_data) return '';
    try {
        const parsed = JSON.parse(currentStoredJob.value.form_data);
        return YAML.stringify(parsed);
    } catch (e) {
        console.error('Error parsing form data:', e);
        return 'Error parsing form data: ' + e.message;
    }
});

const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

function previewDetails(storedJob) {
    currentStoredJob.value = storedJob;
    showStoredJobDetails.value = true;
}

function offcanvasClose() {
    showStoredJobDetails.value = false;
}

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
            <AppAdminMulti v-if="authenticated" apiVersion="2" ref="adminMulti" :settings="settings.stored_jobs" @preview="previewDetails" />
            <BsOffCanvas title="Stored Job Details" :show="showStoredJobDetails" @close="offcanvasClose">
                <div v-if="currentStoredJob" class="stored-job-details">
                    <div class="row mb-3">
                        <div class="col-sm-3"><label class="form-label fw-bold">Name</label></div>
                        <div class="col-sm-9">{{ currentStoredJob.name }}</div>
                    </div>
                    <div class="row mb-3" v-if="currentStoredJob.description">
                        <div class="col-sm-3"><label class="form-label fw-bold">Description</label></div>
                        <div class="col-sm-9">{{ currentStoredJob.description }}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-3"><label class="form-label fw-bold">Form</label></div>
                        <div class="col-sm-9">{{ currentStoredJob.form_name }}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-3"><label class="form-label fw-bold">User</label></div>
                        <div class="col-sm-9">{{ currentStoredJob.username }}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-3"><label class="form-label fw-bold">Created At</label></div>
                        <div class="col-sm-9">{{ formatDateTime(currentStoredJob.created_at) }}</div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-sm-3"><label class="form-label fw-bold">Expires At</label></div>
                        <div class="col-sm-9">{{ formatDateTime(currentStoredJob.expires_at) }}</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold">Form Data (YAML)</label>
                        <pre v-highlightjs class="mt-2"><code language="yaml" class="p-3 bg-light border rounded d-block">{{ formDataYaml }}</code></pre>
                    </div>
                </div>
            </BsOffCanvas>
        </main>
    </div>
</template>
