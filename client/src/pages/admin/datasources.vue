<script setup>
import axios from 'axios';
import Profile from '@/lib/Profile';
import settings from '@/config/settings';
import TokenStorage from '@/lib/TokenStorage';

const adminMulti = ref(null);
const currentDatasource = ref(null);
const showDatasourceOutput = ref(false);
const authenticated = ref(false);


function previewOutput(datasource) {
    currentDatasource.value = datasource;
    showDatasourceOutput.value = true;
}

function offcanvasClose() {
    showDatasourceOutput.value = false;
}


async function triggerImport(datasource) {
    adminMulti.value.setItemProperty({ id: datasource.id, key: "status", value: "running" });
    await axios.post(`/api/v1/datasource/${datasource.id}/import`, {}, TokenStorage.getAuthentication());
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
            <AppAdminMulti v-if="authenticated" ref="adminMulti" :settings="settings.datasources" @preview="previewOutput" @trigger="triggerImport" />
            <BsOffCanvas title="Last Output" :show="showDatasourceOutput" @close="offcanvasClose">
                <pre>{{ currentDatasource?.output || 'Loading...' }}</pre>
            </BsOffCanvas>
        </main>
    </div>
</template>
