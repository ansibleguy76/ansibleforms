<script setup>
import { toast } from "vue-sonner";
import { ref, onMounted } from 'vue';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
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
                restores.value[item.folder] = t('admin.backups.restoring');
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
            toast.warning(t('admin.backups.restoreInProgress'));
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
          {{ t('admin.backups.restoreTitle') }} {{ currentBackup.folder }}
      </template>
      <template #default>

              <ul class="list-group list-group-flush mt-3">
                <li class="list-group-item">
                  <strong>{{ t('admin.backups.folder') }}:</strong> {{ currentBackup.folder }}
                </li>
                <li class="list-group-item">
                  <strong>{{ t('admin.backups.date') }}:</strong> {{ dayjs(currentBackup.date).format('YYYY-MM-DD HH:mm:ss') }}
                </li>
                <li class="list-group-item" v-if="currentBackup.description">
                  <strong>{{ t('admin.backups.description') }}:</strong> {{ currentBackup.description }}
                </li>
                <li class="list-group-item">
                  <strong>{{ t('admin.backups.backupFile') }}:</strong>
                  <span v-if="currentBackup.backupFileExists">
                    {{ t('admin.backups.exists') }} ({{ Helpers.humanFileSize(currentBackup.backupFileSize) }})
                  </span>
                  <span v-else>
                    {{ t('admin.backups.notFound') }}
                  </span>
                </li>
                <li class="list-group-item">
                  <strong>{{ t('admin.backups.configYaml') }}:</strong>
                  <span v-if="currentBackup.configYamlExists">
                    {{ t('admin.backups.exists') }} ({{ Helpers.humanFileSize(currentBackup.configYamlSize) }})
                  </span>
                  <span v-else>
                    {{ t('admin.backups.notFound') }}
                  </span>
                </li>
                <li class="list-group-item">
                  <strong>{{ t('admin.backups.formsDirectory') }}:</strong>
                  <span v-if="currentBackup.formsDirExists">
                    {{ t('admin.backups.exists') }} ({{ currentBackup.formsDirFileCount }} {{ t('admin.backups.files') }}, {{ Helpers.humanFileSize(currentBackup.formsDirTotalSize) }})
                  </span>
                  <span v-else>
                    {{ t('admin.backups.notFound') }}
                  </span>
                </li>
              </ul>
              <br />
              <BsCheckbox
                v-model="backupFirst"
                :label="t('admin.backups.backupBeforeRestore')"
                class="mb-3"
              />
          
      </template>
      <template #footer>
          <BsButton icon="undo" @click="triggerRestore(currentBackup)">{{ t('admin.backups.restoreTitle') }}</BsButton>
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
      <BsOffCanvas :title="t('admin.backups.backupDetails')" :show="showBackupDetails" @close="offcanvasClose">
          <div v-if="currentBackup">
            <ul class="list-group list-group-flush">
              <li class="list-group-item">
                <strong>{{ t('admin.backups.folder') }}:</strong> {{ currentBackup.folder }}
              </li>
              <li class="list-group-item">
                <strong>{{ t('admin.backups.date') }}:</strong> {{ dayjs(currentBackup.date).format('YYYY-MM-DD HH:mm:ss') }}
              </li>
              <li class="list-group-item" v-if="currentBackup.description">
                <strong>{{ t('admin.backups.description') }}:</strong> {{ currentBackup.description }}
              </li>
              <li class="list-group-item">
                <strong>{{ t('admin.backups.backupFile') }}:</strong>
                <span v-if="currentBackup.backupFileExists">
            {{ t('admin.backups.exists') }} ({{ Helpers.humanFileSize(currentBackup.backupFileSize) }})
                </span>
                <span v-else>
            {{ t('admin.backups.notFound') }}
                </span>
              </li>
              <li class="list-group-item">
                <strong>{{ t('admin.backups.configYaml') }}:</strong>
                <span v-if="currentBackup.configYamlExists">
            {{ t('admin.backups.exists') }} ({{ Helpers.humanFileSize(currentBackup.configYamlSize) }})
                </span>
                <span v-else>
            {{ t('admin.backups.notFound') }}
                </span>
              </li>
              <li class="list-group-item">
                <strong>{{ t('admin.backups.formsDirectory') }}:</strong>
                <span v-if="currentBackup.formsDirExists">
            {{ t('admin.backups.exists') }} ({{ currentBackup.formsDirFileCount }} {{ t('admin.backups.files') }}, {{ Helpers.humanFileSize(currentBackup.formsDirTotalSize) }})
                </span>
                <span v-else>
            {{ t('admin.backups.notFound') }}
                </span>
              </li>
            </ul>
          </div>
          <div v-else>
            {{ t('admin.loading') }}
          </div>


      </BsOffCanvas>      
    </main>
  </div>
</template>
