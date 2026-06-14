<script setup>
import axios from "axios";
import { toast } from "vue-sonner";
import TokenStorage from "@/lib/TokenStorage";
import State from "@/lib/State";
import Profile from "@/lib/Profile";
import { useAppStore } from "@/stores/app";
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const store = useAppStore();
const authenticated = ref(false);
const fileInput = ref(null);
const selectedFile = ref(null);
const preview = ref(null);
const busy = ref(false);

// keep in sync with the server (logo.controller.js) ; the server re-validates
// the type with magic-byte sniffing and enforces the size limit anyway
const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const maxBytes = 900 * 1024;

function onFileChange(e) {
  selectedFile.value = null;
  preview.value = null;
  const file = e.target.files?.[0];
  if (!file) return;
  if (!allowedTypes.includes(file.type)) {
    toast.error(t('logo.invalidType'));
    fileInput.value.value = "";
    return;
  }
  if (file.size > maxBytes) {
    toast.error(t('logo.tooLarge'));
    fileInput.value.value = "";
    return;
  }
  selectedFile.value = file;
  const reader = new FileReader();
  reader.onload = () => { preview.value = reader.result; };
  reader.readAsDataURL(file);
}

async function upload() {
  if (!selectedFile.value) return;
  busy.value = true;
  try {
    const formData = new FormData();
    formData.append("logo", selectedFile.value);
    await axios.post(`/api/v2/logo`, formData, TokenStorage.getAuthenticationMultipart());
    toast.success(t('logo.uploaded'));
    selectedFile.value = null;
    preview.value = null;
    fileInput.value.value = "";
    await State.loadLogo();
  } catch (err) {
    const error = err.response?.data?.error || err.message;
    const details = err.response?.data?.details;
    toast.error(details ? `${error}: ${details}` : error);
  } finally {
    busy.value = false;
  }
}

async function removeLogo() {
  busy.value = true;
  try {
    await axios.delete(`/api/v2/logo`, TokenStorage.getAuthentication());
    toast.success(t('logo.removed'));
    await State.loadLogo();
  } catch (err) {
    const error = err.response?.data?.error || err.message;
    const details = err.response?.data?.details;
    toast.error(details ? `${error}: ${details}` : error);
  } finally {
    busy.value = false;
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
      <AppSettings v-if="authenticated" icon="image" :title="t('logo.title')">
        <template #actions>
          <BsButton v-if="store.customLogo && !store.logoIsDefault" cssClass="ms-3" icon="trash" :disabled="busy" @click="removeLogo()">{{ t('logo.remove') }}</BsButton>
        </template>
        <template #default>
          <div class="mb-3">
            <label class="form-label fw-bold">{{ t('logo.current') }}</label>
            <div class="p-3 bg-body-tertiary rounded d-flex align-items-center" style="min-height:4rem">
              <img v-if="store.customLogo" :src="store.customLogo" class="logo-preview" />
              <span v-else class="text-muted">{{ t('logo.default') }}</span>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">{{ t('logo.upload') }}</label>
            <p>{{ t('logo.description') }}</p>
            <input ref="fileInput" class="form-control" type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="onFileChange" />
            <div class="form-text">{{ t('logo.constraints') }}</div>
          </div>
          <div v-if="preview" class="mb-3">
            <label class="form-label fw-bold">{{ t('logo.preview') }}</label>
            <div class="p-3 bg-body-tertiary rounded d-flex align-items-center" style="min-height:4rem">
              <img :src="preview" class="logo-preview" />
            </div>
          </div>
          <div class="mb-3">
            <BsButton icon="upload" :disabled="!selectedFile || busy" @click="upload()">{{ t('logo.uploadButton') }}</BsButton>
          </div>
        </template>
      </AppSettings>
    </main>
  </div>
</template>
<style scoped lang="scss">
.logo-preview {
  max-width: 200px;
  max-height: 30px;
}
</style>
