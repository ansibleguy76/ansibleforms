<script setup>
import axios from 'axios';
import Profile from '@/lib/Profile';
import settings from '@/config/settings';
import TokenStorage from '@/lib/TokenStorage';

const adminMulti = ref(null);
const currentDataSchema = ref(null);
const showDataSchemaOutput = ref(false);
const authenticated = ref(false);


function previewOutput(dataSchema) {
    currentDataSchema.value = dataSchema;
    showDataSchemaOutput.value = true;
}

function offcanvasClose() {
    showDataSchemaOutput.value = false;
}


async function triggerReset(dataSchema) {
    adminMulti.value.setItemProperty({ id: dataSchema.id, key: "status", value: "running" });
    await axios.post(`/api/v1/datasource/schema/${dataSchema.id}/reset`, {}, TokenStorage.getAuthentication());
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
            <AppAdminMulti v-if="authenticated" ref="adminMulti" :settings="settings.dataSchemas" @preview="previewOutput" @reset="triggerReset" />
            <BsOffCanvas title="Last Output" :show="showDataSchemaOutput" @close="offcanvasClose">
                <pre>{{ currentDataSchema?.output || 'Loading...' }}</pre>
            </BsOffCanvas>
        </main>
    </div>
</template>
