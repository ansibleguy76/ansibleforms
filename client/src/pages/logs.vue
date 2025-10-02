<script setup>
import axios from 'axios';
import TokenStorage from '@/lib/TokenStorage';
import ansiParse from '@/lib/AnsiParse';
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'vue-toastification';
import Helpers from '@/lib/Helpers';

const log = ref('');
const isLoading = ref(false);
const filter = ref('');
const scroller = ref(null);
const refresh = ref(false);
const lines = ref(100);
const lineOptions = [
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 300, label: '300' },
  { value: 400, label: '400' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
];

const toast = useToast();

const filtered = computed(() => {
  if (filter.value) {
    return log.value.split("\n").filter(x => x.match(filter.value) && x != "").map(x => ansiParse(x))
  } else {
    return log.value.split("\n").filter(x => x != "").map(x => ansiParse(x))
  }
})
async function scrollToBottom() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const lastChildElement = scroller.value?.lastElementChild;
  lastChildElement?.scrollIntoView({
    behavior: 'smooth',
  })
}
watch(lines, async () => {
  await load(true)
})
watch(refresh, async () => {
  if (refresh.value) {
    await load(true)
  }
})
async function load(force = false) {
  if (!isLoading.value && (refresh.value || force)) {
    isLoading.value = true;
    const result = await axios.get(`/api/v1/log?lines=${lines.value || 100}`, TokenStorage.getAuthentication())
    if (result.data != "...") {
      log.value = result.data
      isLoading.value = false
      await scrollToBottom()
    }
    if (refresh.value) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await load()
    }
  }
}
async function downloadWithAxios(url, authHeaders) {
  const response = await axios({
    method: 'get',
    headers: authHeaders.headers,
    url,
    responseType: 'arraybuffer',
  })
  Helpers.forceFileDownload(response)
}

async function download() {
  try {
    await downloadWithAxios(`/api/v1/log/download`, TokenStorage.getAuthentication())
  } catch (err) {
    toast.error(err.message)
  }
}
onMounted(async () => {
  await load(true)
})
</script>
<template>


  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex container-xxl">
      <AppSettings title="Logs" icon="file-lines">
        <template #actions>
          <div class="ms-2">
            <BsInput :isFloating="false" type="checkbox" v-model="refresh" label="Auto refresh" :isInline="true"></BsInput>
          </div>
          <div class="ms-2">
            <BsInput :isFloating="false" type="select" icon="arrows-up-down" v-model="lines" :values="lineOptions" label="" :isInline="true"></BsInput>
          </div>
          <div class="ms-2">
            <BsInput cssClass="ms-2" label="" :isInline="true" :isFloating="false" icon="filter" v-model="filter" placeholder="regex"></BsInput>
          </div>
          <BsButton class="ms-2" icon="refresh" :isIconButton="true" @click="load(true)"></BsButton>
          <BsButton class="ms-2" icon="download" @click="download()">Download</BsButton>
        </template>
        <template #default>
          <div ref="scroller" id="scroller" class="font-monospace fs-6">
            <div v-for="t, i in filtered">
              <div class="text-end pe-1 me-3 d-inline-block bg-secondary-subtle" style="width:40px;">{{ i + 1 }}</div><span v-for="s in t" v-text="s.text" :class="s.foreground || ''"></span>
            </div>
          </div>
        </template>
      </AppSettings>
    </main>
  </div>
</template>
<style scoped>
#scroller {
  height: calc(100vh - 170px);
  overflow-y: scroll;
  overflow-x: hidden;
}
</style>
<route lang="yaml">
  meta:
    layout: standard
</route>