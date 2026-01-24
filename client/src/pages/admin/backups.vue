<script setup>
import { useToast } from "vue-toastification";
import { ref, onMounted } from 'vue';
import settings from '@/config/settings';
import Profile from '@/lib/Profile';
import axios from 'axios';
import TokenStorage from '@/lib/TokenStorage';
import Helpers from '@/lib/Helpers.js';
import dayjs from 'dayjs';

const adminMulti = ref(null);
const authenticated = ref(false);
const currentBackup = ref(null);
const showBackupDetails = ref(false);
const restores = ref({});
const backupFirst = ref(true);
const action = ref('');

const toast = useToast();


function previewDetails(folder) {
    currentBackup.value = folder;
    showBackupDetails.value = true;
}

function offcanvasClose() {
    showBackupDetails.value = false;
}

function restoreClose() {
    action.value = '';
    backupFirst.value = true;
}

function restoreOpen(folder) {
    currentBackup.value = folder;
    action.value = 'restore';
}

async function triggerRestore(item) {
    restoreClose()
    if (item) {
        if (!restores.value[item.folder]) {
            try {
                restores.value[item.folder] = "Restoring...";
                const result = await axios.post(
                    `/api/v2/backup/${item.folder}/restore?backupFirst=${backupFirst.value}`,
                    {},
                    TokenStorage.getAuthentication()
                );
                toast.success(result.data.message);
                adminMulti.value.loadItems()
            } catch (err) {
                const msg = Helpers.parseAxiosResponseError(err, "Custom fallback message");
                toast.error(msg);
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
  <BsModal v-if="action == 'restore'" @close="restoreClose">
      <template #title>
          Restore {{ currentBackup.folder }}
      </template>
      <template #default>

              <ul class="list-group list-group-flush mt-3">
                <li class="list-group-item">
                  <strong>Folder:</strong> {{ currentBackup.folder }}
                </li>
                <li class="list-group-item">
                  <strong>Date:</strong> {{ dayjs(currentBackup.date).format('YYYY-MM-DD HH:mm:ss') }}
                </li>
                <li class="list-group-item" v-if="currentBackup.description">
                  <strong>Description:</strong> {{ currentBackup.description }}
                </li>
                <li class="list-group-item">
                  <strong>Backup File:</strong>
                  <span v-if="currentBackup.backupFileExists">
                    Exists ({{ Helpers.humanFileSize(currentBackup.backupFileSize) }})
                  </span>
                  <span v-else>
                    Not found
                  </span>
                </li>
                <li class="list-group-item">
                  <strong>Config YAML:</strong>
                  <span v-if="currentBackup.configYamlExists">
                    Exists ({{ Helpers.humanFileSize(currentBackup.configYamlSize) }})
                  </span>
                  <span v-else>
                    Not found
                  </span>
                </li>
                <li class="list-group-item">
                  <strong>Forms Directory:</strong>
                  <span v-if="currentBackup.formsDirExists">
                    Exists ({{ currentBackup.formsDirFileCount }} files, {{ Helpers.humanFileSize(currentBackup.formsDirTotalSize) }})
                  </span>
                  <span v-else>
                    Not found
                  </span>
                </li>
              </ul>
              <br />
              <BsCheckbox
                v-model="backupFirst"
                label="Create a new backup before restoring (recommended)"
                class="mb-3"
              />
          
      </template>
      <template #footer>
          <BsButton icon="undo" @click="triggerRestore(currentBackup)">Restore</BsButton>
      </template>
  </BsModal>  
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap container-xxl">
      <AppSidebar />
      <AppAdminMulti
        v-if="authenticated"
        ref="adminMulti"
        :settings="settings.backups"
        apiVersion="2"
        @trigger="restoreOpen"
        @preview="previewDetails"
        @reset="null"
      />
      <BsOffCanvas title="Backup details" :show="showBackupDetails" @close="offcanvasClose">
          <div v-if="currentBackup">
            <ul class="list-group list-group-flush">
              <li class="list-group-item">
                <strong>Folder:</strong> {{ currentBackup.folder }}
              </li>
              <li class="list-group-item">
                <strong>Date:</strong> {{ dayjs(currentBackup.date).format('YYYY-MM-DD HH:mm:ss') }}
              </li>
              <li class="list-group-item" v-if="currentBackup.description">
                <strong>Description:</strong> {{ currentBackup.description }}
              </li>
              <li class="list-group-item">
                <strong>Backup File:</strong>
                <span v-if="currentBackup.backupFileExists">
            Exists ({{ Helpers.humanFileSize(currentBackup.backupFileSize) }})
                </span>
                <span v-else>
            Not found
                </span>
              </li>
              <li class="list-group-item">
                <strong>Config YAML:</strong>
                <span v-if="currentBackup.configYamlExists">
            Exists ({{ Helpers.humanFileSize(currentBackup.configYamlSize) }})
                </span>
                <span v-else>
            Not found
                </span>
              </li>
              <li class="list-group-item">
                <strong>Forms Directory:</strong>
                <span v-if="currentBackup.formsDirExists">
            Exists ({{ currentBackup.formsDirFileCount }} files, {{ Helpers.humanFileSize(currentBackup.formsDirTotalSize) }})
                </span>
                <span v-else>
            Not found
                </span>
              </li>
            </ul>
          </div>
          <div v-else>
            Loading...
          </div>


      </BsOffCanvas>      
    </main>
  </div>
</template>
