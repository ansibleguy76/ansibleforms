<script setup>
import axios from 'axios';
import Profile from '@/lib/Profile';
import settings from '@/config/settings';
import TokenStorage from '@/lib/TokenStorage';

const adminMulti = ref(null);
const currentRepo = ref(null);
const showRepoOutput = ref(false);
const authenticated = ref(false);


function previewOutput(repo) {
    currentRepo.value = repo;
    showRepoOutput.value = true;
}

function offcanvasClose() {
    showRepoOutput.value = false;
}

async function triggerClone(repo) {
    adminMulti.value.setItemProperty({ id: repo.name, key: "status", value: "running" });
    await axios.post(`/api/v1/repository/${repo.name}/clone`, {}, TokenStorage.getAuthentication());
    // wait 1 second to visually see the change
    await new Promise(r => setTimeout(r, 1000));
    adminMulti.value.loadItems()
}
async function triggerReset(repo) {
    adminMulti.value.setItemProperty({ id: repo.name, key: "status", value: "running" });
    await axios.post(`/api/v1/repository/${repo.name}/reset`, {}, TokenStorage.getAuthentication());
    // wait 1 second to visually see the change
    await new Promise(r => setTimeout(r, 1000));
    adminMulti.value.loadItems()
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
            <AppAdminMulti v-if="authenticated" ref="adminMulti" :settings="settings.repositories" @trigger="triggerClone" @preview="previewOutput" @reset="triggerReset" />
            <BsOffCanvas title="Last Output" :show="showRepoOutput" @close="offcanvasClose">
                <pre>{{ currentRepo?.output || 'Loading...' }}</pre>
            </BsOffCanvas>
        </main>
    </div>
</template>
