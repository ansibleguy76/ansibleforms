<script setup>

import { ref } from 'vue';
import Profile from '@/lib/Profile';
import copy from 'copy-to-clipboard';
import settings from '@/config/settings';
import { useToast } from 'vue-toastification';

const currentItem = ref(null);
const toast = useToast();
const authenticated = ref(false);


function preview(item) {
    try {
        currentItem.value = item;
        // clipboard.writeSync(currentItem.value)
        copy(currentItem.value);
        toast.success('Copied to clipboard');
    } catch {
        toast.error('Could not copy to clipboard, https required');
    }

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
            <AppAdminMulti v-if="authenticated" :settings="settings.knownhosts" @preview="preview">
                <p class="p-2 border text-break" v-if="currentItem">{{ currentItem.name }}</p>
            </AppAdminMulti>
        </main>
    </div>

</template>
