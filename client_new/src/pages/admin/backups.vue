<script setup>
import { useToast } from "vue-toastification";
import { ref, onMounted } from 'vue';
import settings from '@/config/settings';
import Profile from '@/lib/Profile';
import axios from 'axios';
import TokenStorage from '@/lib/TokenStorage';

const adminMulti = ref(null);
const authenticated = ref(false);
const restores = ref({});

const toast = useToast();

async function triggerRestore(item) {
    if (item) {
        if (!restores.value[item.folder]) {
            try {
                restores.value[item.folder] = "Restoring...";
                const result = await axios.post(
                    `/api/v2/backup/${item.folder}/restore?backupFirst=true`,
                    {},
                    TokenStorage.getAuthentication()
                );
                toast.success(result.data.message);
                adminMulti.value.loadItems()
            } catch (err) {
                toast.error(err.message);
            } finally {
                delete restores.value[item.id];
            }
        } else {
            toast.warning("Restore already in progress");
        }
    }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
});
</script>

<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap container-xxl">
      <AppSidebar />
      <AppAdminMulti
        v-if="authenticated"
        ref="adminMulti"
        :settings="settings.backups"
        apiVersion="2"
        @trigger="triggerRestore"
        @preview="null"
        @reset="null"
      />
    </main>
  </div>
</template>
