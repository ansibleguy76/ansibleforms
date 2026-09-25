<script setup>

  /******************************************************************/
  /*                                                                */
  /*  HashiCorp Vault connection                                    */
  /*                                                                */
  /*  Under CONNECTIONS, not in the settings environment tabs: it   */
  /*  is an outbound endpoint with an address, a token and a tls    */
  /*  flag - the same shape as A.A.P., Mail and Repositories, and   */
  /*  like them it has a 'test the connection' action, which a      */
  /*  generic table of environment variables cannot offer.          */
  /*                                                                */
  /*  These seven values are still environment variables. They are  */
  /*  saved through PUT /api/v2/config/env, which writes            */
  /*  persistent/.env - so a value set in the real environment      */
  /*  (docker-compose, kubernetes) stays read-only here, because a  */
  /*  file cannot override it. Six of the seven take effect at once */
  /*  because vault.js re-reads process.env on every operation ;    */
  /*  VAULT_CACHE_TTL_MS needs a restart, its cache being built     */
  /*  once at import.                                               */
  /*                                                                */
  /******************************************************************/

  import { ref, computed, onMounted } from "vue";
  import { useI18n } from 'vue-i18n';
  import axios from "axios";
  import { toast } from 'vue-sonner';
  import TokenStorage from "@/lib/TokenStorage";
  import Helpers from "@/lib/Helpers";
  import Profile from "@/lib/Profile";

  const { t } = useI18n();

  // the order they are presented in : address first, then credentials, then behaviour
  const FIELDS = [
    { name: 'VAULT_ADDR', icon: 'globe', type: 'text' },
    { name: 'VAULT_TOKEN', icon: 'key', type: 'password' },
    { name: 'VAULT_NAMESPACE', icon: 'sitemap', type: 'text' },
    { name: 'VAULT_DEFAULT_MOUNT', icon: 'folder-open', type: 'text' },
    { name: 'VAULT_KV_VERSION', icon: 'hashtag', type: 'number' },
    { name: 'VAULT_CACHE_TTL_MS', icon: 'clock', type: 'number' },
    { name: 'VAULT_SKIP_VERIFY', icon: 'shield-halved', type: 'text' },
  ];

  const authenticated = ref(false);
  const loading = ref(false);
  const rows = ref([]);
  const edits = ref({});
  const baseline = ref({});
  const testResult = ref(null);
  // Discovered from the connected Vault. Empty until it answers - on a first-time setup
  // there is no address or token yet, and a restricted token may not be allowed to list,
  // so the Default mount field falls back to free text rather than offering nothing.
  const mounts = ref([]);
  const restartPending = ref([]);

  const byName = computed(() => Object.fromEntries(rows.value.map(r => [r.name, r])));
  const fields = computed(() => FIELDS.map(f => ({ ...f, meta: byName.value[f.name] })).filter(f => f.meta));
  const editable = (meta) => meta && meta.editable !== 'refused' && !meta.overridden;
  // 'true, false' and '1, 2' are documented enums, so they get a dropdown
  const options = (meta) => {
    if (meta?.name === 'VAULT_DEFAULT_MOUNT') return mountOptions.value;
    return Helpers.envAllowedOptions(meta?.allowed);
  };

  // The mount currently configured is kept in the list even when Vault did not report it,
  // so opening the page cannot silently swap a working value for the first alternative.
  const mountOptions = computed(() => {
    if (!mounts.value.length) return null;
    const current = String(edits.value.VAULT_DEFAULT_MOUNT ?? byName.value.VAULT_DEFAULT_MOUNT?.value ?? '');
    const list = mounts.value.map(m => ({
      value: m.path,
      label: m.version ? `${m.path} (KV v${m.version})` : m.path,
    }));
    if (current && !list.some(o => o.value === current)) list.unshift({ value: current, label: current });
    return list;
  });

  async function loadMounts() {
    if (!configured.value) { mounts.value = []; return; }
    try {
      const result = await axios.get('/api/v2/config/vault/mounts', TokenStorage.getAuthentication());
      mounts.value = result.data?.records || [];
    } catch {
      // expected when Vault is unreachable or the token may not list : stay on free text
      mounts.value = [];
    }
  }

  const dirtyNames = computed(() => Object.keys(edits.value).filter(k => {
    // a blank token box means 'keep the current one', never 'clear it'
    if (byName.value[k]?.secret && String(edits.value[k] ?? '') === '') return false;
    return String(edits.value[k] ?? '') !== String(baseline.value[k] ?? '');
  }));
  const dirty = computed(() => dirtyNames.value.length > 0);
  // Not while there are unsaved edits : the test uses what the server has, so it would
  // pass or fail on the previous values and read as a verdict on what you are looking at.
  const canTest = computed(() => configured.value && !dirty.value);

  const configured = computed(() => {
    const addr = byName.value.VAULT_ADDR;
    const token = byName.value.VAULT_TOKEN;
    return !!(addr?.value && token?.set);
  });

  async function load() {
    loading.value = true;
    try {
      const result = await axios.get('/api/v2/config/env', TokenStorage.getAuthentication());
      rows.value = (result.data || []).filter(e => e.name.startsWith('VAULT_'));
      const seed = {};
      for (const e of rows.value) if (editable(e)) seed[e.name] = e.secret ? '' : (e.value ?? '');
      edits.value = { ...seed };
      baseline.value = { ...seed };
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    const names = dirtyNames.value;
    if (!names.length) return;
    const payload = {};
    for (const n of names) payload[n] = edits.value[n] ?? '';
    try {
      const result = await axios.put('/api/v2/config/env', payload, TokenStorage.getAuthentication());
      toast.success(result.data.message);
      restartPending.value = result.data?.restartRequired || [];
      testResult.value = null;
      await load();
      loadMounts();
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
    }
  }

  async function test() {
    testResult.value = null;
    try {
      const result = await axios.post('/api/v2/config/vault/check', {}, TokenStorage.getAuthentication());
      testResult.value = result.data;
      toast.success(t('settings.vault.testOk'));
      await loadMounts();
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
    }
  }

  onMounted(async () => {
    authenticated.value = !!(await Profile.load());
    if (authenticated.value) {
      await load();
      loadMounts();   // deliberately not awaited : a slow Vault must not delay the page
    }
  });
</script>
<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap container-xxl">
      <AppSidebar />
      <AppSettings v-if="authenticated" :title="t('settings.vault.title')" :description="t('settings.vault.description')" icon="vault">
      <template #default>
        <div v-if="restartPending.length" class="alert alert-warning py-2">
          <FaIcon icon="triangle-exclamation" class="me-2" />
          {{ t('settings.settingsPage.envRestartPending', { names: restartPending.join(', ') }) }}
        </div>
        <div v-if="loading && !rows.length" class="spinner-border" role="status">
          <span class="visually-hidden">{{ t('settings.common.loading') }}</span>
        </div>
        <template v-for="(f, i) in fields" :key="f.name">
          <div v-if="i > 0" class="mt-4"></div>
          <!-- same field shape as the settings page : label, control, one line of help -->
          <BsInput v-if="editable(f.meta)" :isFloating="false"
            :icon="f.icon"
            :type="options(f.meta) ? 'select' : (f.meta.secret ? 'password' : f.type)"
            :values="options(f.meta) || []"
            valueKey="value" labelKey="label"
            :label="f.meta.short || f.name"
            :help="f.meta.hint || ''"
            :placeholder="f.meta.secret && f.meta.set ? t('settings.settingsPage.envSecretUnchanged') : ''"
            v-model="edits[f.name]" />
          <div v-else class="mb-3">
            <label class="form-label fw-bold">{{ f.meta.short || f.name }}</label>
            <div>
              <div class="input-group">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="lock" /></span>
                <div class="form-control vault-value" :title="f.name">{{ f.meta.value === null || f.meta.value === '' ? '—' : f.meta.value }}</div>
              </div>
            </div>
            <div v-if="f.meta.hint" class="form-text">{{ f.meta.hint }}</div>
            <div class="form-text fst-italic">
              {{ f.meta.overridden ? t('settings.settingsPage.envOverridden') : (f.meta.refusedReason || '') }}
            </div>
          </div>
          <div v-if="editable(f.meta) && f.meta.editable === 'restart'" class="form-text vault-restart">
            {{ t('settings.settingsPage.envRestartRequired') }}
          </div>
        </template>

        <!-- what the test actually proved, rather than a bare green tick -->
        <div v-if="testResult" class="mt-4">
          <div class="fw-bold mb-2">{{ t('settings.vault.testResult') }}</div>
          <table class="table table-sm align-middle mb-0">
            <tbody>
              <tr><td class="fw-bold">{{ t('settings.vault.address') }}</td><td class="font-monospace">{{ testResult.addr }}</td></tr>
              <tr><td class="fw-bold">{{ t('settings.vault.namespace') }}</td><td class="font-monospace">{{ testResult.namespace || '—' }}</td></tr>
              <tr><td class="fw-bold">{{ t('settings.vault.kvVersion') }}</td><td class="font-monospace">{{ testResult.kvVersion }} / {{ testResult.defaultMount }}</td></tr>
              <tr><td class="fw-bold">{{ t('settings.vault.tokenTtl') }}</td><td class="font-monospace">{{ testResult.ttl === null ? t('settings.vault.neverExpires') : testResult.ttl + 's' }}</td></tr>
              <tr><td class="fw-bold">{{ t('settings.vault.policies') }}</td><td class="font-monospace">{{ (testResult.policies || []).join(', ') || '—' }}</td></tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #actions>
        <BsButton icon="plug" :colorClass="canTest ? 'primary' : 'secondary'" :disabled="!canTest" @click="test()">{{ t('settings.vault.test') }}</BsButton>
        <BsButton icon="save" :colorClass="dirty ? 'primary' : 'secondary'" cssClass="ms-3" :disabled="!dirty" @click="save()">{{ t('settings.common.save') }}</BsButton>
      </template>
      </AppSettings>
    </main>
  </div>
</template>
<style scoped>
/* The card body has its own bottom padding, so a trailing mb-3 doubles it. Same stacking
   mistake as the paginated cards had: 32px here against ~20px on the other pages.
   :deep is required - the mb-3 wrapper is rendered inside BsInput, so it carries that
   component's scope id and a plain scoped selector never matches it. */
:deep(.card-body) > *:last-child {
  /* !important because Bootstrap's own .mb-3 is !important - every other override of this
     in the codebase does the same, including the global .tab-card-flush-card rule */
  margin-bottom: 0 !important;
}
.vault-value {
  background-color: var(--bs-tertiary-bg);
  height: auto;
  min-height: calc(1.5em + 0.75rem + 2px);
  word-break: break-all;
  font-family: var(--bs-font-monospace);
}
.vault-restart {
  color: var(--af-warning-text, var(--bs-warning-text-emphasis));
}
</style>
