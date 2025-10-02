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
    { name: "import", icon: "file-import", title: "Import Forms from file", dependency: "enableFormsYamlInDatabase" }
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
      >
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
