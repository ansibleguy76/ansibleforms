<script setup>

import { ref } from 'vue';
import Profile from '@/lib/Profile';
import { copyText } from 'vue3-clipboard';
import settings from '@/config/settings';
import { toast } from 'vue-sonner';

const currentItem = ref(null);

const authenticated = ref(false);


function preview(item) {
    try {
        currentItem.value = item;
        // clipboard.writeSync(currentItem.value)
        copyText(currentItem.value);
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
            <AppAdminMulti v-if="authenticated" apiVersion="2" :settings="settings.knownhosts" @preview="preview" />
        </main>
    </div>

</template>
