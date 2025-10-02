<script setup>
import axios from 'axios';
import Profile from '@/lib/Profile';
import settings from '@/config/settings';
import TokenStorage from '@/lib/TokenStorage';

const adminMulti = ref(null);
const currentSchedule = ref(null);
const showScheduleOutput = ref(false);
const authenticated = ref(false);


function previewOutput(schedule) {
    currentSchedule.value = schedule;
    showScheduleOutput.value = true;
}

function offcanvasClose() {
    showScheduleOutput.value = false;
}


async function triggerLaunch(schedule) {
    adminMulti.value.setItemProperty({ id: schedule.id, key: "status", value: "running" });
    await axios.post(`/api/v2/schedule/${schedule.id}/launch`, {}, TokenStorage.getAuthentication());
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
            <AppAdminMulti v-if="authenticated" apiVersion="2" ref="adminMulti" :settings="settings.schedules" @preview="previewOutput" @trigger="triggerLaunch" />
            <BsOffCanvas title="Last Output" :show="showScheduleOutput" @close="offcanvasClose">
                <pre>{{ currentSchedule?.output || 'Loading...' }}</pre>
            </BsOffCanvas>
        </main>
    </div>
</template>
