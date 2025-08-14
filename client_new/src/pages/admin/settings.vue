<script setup>
import { ref, onMounted } from "vue";
import Profile from "@/lib/Profile";
import axios from "axios";
import { useToast } from "vue-toastification";
import TokenStorage from "@/lib/TokenStorage";

const settings = {
  icon: "fac,ansibleforms",
  type: "settings",
  label: "Settings",
  actions: [
    { name: "import", icon: "file-import", title: "Import Forms from file", dependency: "enableFormsYamlInDatabase" },
    { name: "backup", icon: "database", title: "Backup" },
    { name: "restore", icon: "file-import", title: "Restore" }
  ],
  fields : [
    { key: "url", icon: "globe", line:0, label: "Public Root Url", required: true, help:"This url is used for public access to Ansible Forms, used in backlinks and emails." },
    { key: "forms_yaml", type:"editor", line:1, label: "Forms YAML", description:"In case you want the main forms.yaml file in the database instead of loaded from the filesystem. <br><b>Note that the designer will be disabled.</b><br>Use the import button to import from the local forms.yaml file.", lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem"}
  ],
}

const env = ref({});
const config = ref({});
const toast = useToast();
const adminSingle = ref(null);
const authenticated = ref(false);

// Backup & Restore
const action = ref(null);
const backups = ref([]);
const backupToRestore = ref(null);
const backupBeforeRestore = ref(false);
const restoreLoading = ref(false);
const restoreError = ref("");

async function doBackup() {
  try {
    const res = await axios.post("/api/v2/database/backup", {}, TokenStorage.getAuthentication());
    toast.success(res.data?.message || "Backup completed.");
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || "Backup failed.");
  }
}

async function showRestoreList() {
  action.value = "restore";
  restoreLoading.value = true;
  restoreError.value = "";
  try {
    const res = await axios.get("/api/v2/database", TokenStorage.getAuthentication());
    let recs = Array.isArray(res.data.records) ? res.data.records : [];
    // Sort by folder (timestamp) descending
    recs.sort((a, b) => (b.folder || "").localeCompare(a.folder || ""));
    backups.value = recs;
  } catch (err) {
    restoreError.value = err.response?.data?.message || err.message || "Failed to load backups.";
  } finally {
    restoreLoading.value = false;
  }
}

async function restoreBackup() {
  const folder = backupToRestore.value?.folder
  if (!folder) {
    toast.error("Please select a backup to restore.");
    return;
  }
  if (backupBeforeRestore.value) {
    try {
      const dummy = await doBackup();
    } catch (err) {
      toast.error("Backup before restore failed. Restore cancelled.");
      return;
    }
  }
  try {
    await axios.post("/api/v2/database/restore", { folder }, TokenStorage.getAuthentication());
    toast.success("Restore completed.");
    action.value = null;
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || "Restore failed.");
  }
}

function resetAction() {
  action.value = null;
  backupToRestore.value = null;
  backupBeforeRestore.value = false;
}

async function loadEnvironmentVariables() {
  try {
    var result = await axios.get(
      `/api/v1/config/env`,
      TokenStorage.getAuthentication()
    );
    env.value = result.data.data.output;

  } catch (err) {
    console.log("Error loading environment variables");
    toast.error(err.message);  }
}
function importYamlFile() {
  axios.put(`/api/v1/settings/importFormsFileFromYaml`,{},TokenStorage.getAuthentication())
    .then((result)=>{
      if(result.data.status=="error"){
          toast.error(result.data.message + ", " + result.data.data.error);
        }else{
          toast.success(result.data.message);
          adminSingle.value.loadItem();
        }
    }),function(err){
      toast.error(err.message);
    };
}

onMounted(async () => {
    authenticated.value = !!(await Profile.load());
    if (!authenticated.value) {
        return;
    }
    await loadEnvironmentVariables();
});
</script>
<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap container-xxl">
      <AppSidebar />
      <AppAdminSingle
        v-if="authenticated"
        ref="adminSingle"
        :settings="settings"
        @import="importYamlFile()"
        @backup="doBackup()"
        @restore="showRestoreList()"
      >
        <div class="mb-3 d-flex gap-2">
          <button class="btn btn-outline-primary" @click="doBackup">
            <i class="fas fa-database me-2"></i>Backup
          </button>
          <button class="btn btn-outline-warning" @click="showRestoreList">
            <i class="fas fa-file-import me-2"></i>Restore
          </button>
        </div>
        <BsModal v-if="action == 'restore'" @close="resetAction()">
          <template #title> Restore backup </template>
          <template #default>
            <div v-if="restoreLoading" class="text-center py-3">
              <i class="fas fa-spinner fa-spin"></i> Loading backups...
            </div>
            <div v-else-if="restoreError" class="alert alert-danger">{{ restoreError }}</div>
            <div v-else>
              <BsInput type="select_advanced" v-model="backupToRestore" :values="backups" :required="true" name="backup" label="Backup" :sticky="true" :hasError="!backupToRestore" :isLoading="restoreLoading" />
              <BsInput type="checkbox" v-model="backupBeforeRestore" label="Make a backup before restore ?" />
            </div>
          </template>
          <template #footer>
            <BsButton icon="undo" :disabled="!backupToRestore" @click="restoreBackup(); resetAction()">Restore</BsButton>
          </template>
        </BsModal>
        <table class="table table-striped table-bordered table-sm w-100">
          <thead>
            <tr>
              <th>Environment Variable</th>
              <th class="text-center">Set</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in env" :key="e.name">
              <td>{{ e.name }}</td>
              <td class="text-center">
                <font-awesome-icon :icon="e.set ? 'check' : 'times'" :class="{
                  'text-success': e.set,
                  'text-danger': !e.set,
                }" />
              </td>
              <td>{{ e.value }}</td>
            </tr>
          </tbody>
        </table>
      </AppAdminSingle>
    </main>
  </div>
</template>
