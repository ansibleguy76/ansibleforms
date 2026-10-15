<script setup>
/******************************************************************/
/*                                                                */
/*  A runner's page (/settings/runners/<id>), opened from the        */
/*  runners' list : the steps of its dialog as tabs, the tab kept */
/*  in the url -                                                  */
/*    Details         its registration, name, description,        */
/*                    whether it is the default of its kind       */
/*    Type            RTE, AWX, AAP, Ascender, Semaphore, Rundeck,*/
/*                    Jenkins                                     */
/*    Connection      its address (and project), how its          */
/*                    certificate is checked                      */
/*    Credentials  a token, or a user and password (AWX), a       */
/*                    user and its token (Jenkins)                */
/*    Forms           the forms that run on it, by name or as the */
/*                    default of its type                         */
/*    Jobs            the jobs that ran on it, the latest first   */
/*  Test connection, Delete and Save top right ; its token (or    */
/*  right, beside Save. A runner of the config seed is read only. */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import { useAppStore } from '@/stores/app';
import { RUNNER_KINDS, PROJECT_RUNNER_KINDS, AWX_RUNNER_KINDS, runnerKind, registrationPill } from '@/config/settings';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';
import { useFormLinks } from '@/composables/useFormLinks';
import { formPath } from '@/lib/formsPath';
import Time from '@/lib/Time';
import { durationSeconds, formatDuration } from '@/lib/jobTime';
import { recordButtons } from '@/lib/recordButtons';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authenticated = ref(false);
const loaded = ref(false);

// ─── the runner ───────────────────────────────────────────────────────────────
const runnerId = computed(() => String(route.params.id || ''));
const runner = ref(null); // as saved
const edit = ref(null); // as edited
// what this page edits : the token and the password have their own dialog
const EDITED = [
  'name',
  'description',
  'kind',
  'uri',
  'project',
  'use_credentials',
  'username',
  'skip_verify',
  'custom_ca',
  'ca_bundle',
];
// an example address of each kind, as the dialog's
const URI_EXAMPLE = {
  rte: 'https://rte-vmware:8000',
  awx: 'https://awx.example.com/api/v2',
  aap: 'https://aap.example.com/api/controller/v2',
  ascender: 'https://ascender.example.com/api/v2',
  semaphore: 'https://semaphore.example.com',
  rundeck: 'https://rundeck.example.com',
  jenkins: 'https://jenkins.example.com',
};

/**
 * The fields of a runner as this page edits them : its kind from its type and flavour, the
 * certificate checks from ignore_certs and its CA bundle.
 *
 * Args:
 *   record (object): the runner.
 *
 * Returns:
 *   object: the edited fields.
 */
function editable(record) {
  return {
    name: record.name ?? '',
    description: record.description ?? '',
    kind: runnerKind(record),
    uri: record.uri ?? '',
    project: record.project ?? '',
    use_credentials: !!record.use_credentials,
    username: record.username ?? '',
    skip_verify: !!record.ignore_certs,
    custom_ca: !!String(record.ca_bundle || '').trim(),
    ca_bundle: record.ca_bundle ?? '',
  };
}

const managed = computed(() => !!runner.value?.managed);
// a runner receives the credentials of the jobs it runs : only an admin changes one (the server
// refuses the others) ; a seeded one nobody changes here
const appStore = useAppStore();
const readOnly = computed(() => managed.value || !appStore.isAdmin);
const isRte = computed(() => edit.value?.kind === 'rte');
// a Semaphore or a Rundeck : a project on its server, signed in with a token
const hasProject = computed(() => PROJECT_RUNNER_KINDS.includes(edit.value?.kind));
// an AWX, an AAP or an Ascender take a token or a user and password ; the others a token
const isAwxKind = computed(() => AWX_RUNNER_KINDS.includes(edit.value?.kind));
/**
 * Whether its Type tab can switch to a kind : its type stays what it was made as (the forms that
 * run on it expect it), an AWX one may change product (AWX, AAP, Ascender : one type).
 *
 * Args:
 *   kind (string): a kind of RUNNER_KINDS.
 *
 * Returns:
 *   boolean: whether it can be chosen.
 */
function kindAllowed(kind) {
  const saved = runner.value ? runnerKind(runner.value) : edit.value?.kind;
  return kind === saved || (AWX_RUNNER_KINDS.includes(kind) && AWX_RUNNER_KINDS.includes(saved));
}
const usesCredentials = computed(() => isAwxKind.value && !!edit.value?.use_credentials);
// a Jenkins signs in with a user and that user's API token ; its folder (project) is optional
const isJenkins = computed(() => edit.value?.kind === 'jenkins');
const hasUsername = computed(() => usesCredentials.value || isJenkins.value);
const dirty = computed(
  () =>
    !!runner.value &&
    (EDITED.some((k) => String(edit.value[k] ?? '') !== String(editable(runner.value)[k] ?? '')) || !!newSecret.value),
);
// leaving with the runner changed and unsaved asks first
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

/**
 * Loads the runner.
 */
async function load() {
  try {
    const res = await axios.get(`/api/v2/runner/${encodeURIComponent(runnerId.value)}`);
    const record = res.data.records ? res.data.records[0] : res.data;
    // its registration (state) is added to the list only : read from there
    if (record) {
      const list = await axios.get('/api/v2/runner/').catch(() => null);
      const listed = (list?.data?.records || []).find((r) => String(r.id) === String(record.id));
      if (listed?.state) record.state = listed.state;
    }
    runner.value = record || null;
    edit.value = record ? editable(record) : null;
  } catch {
    runner.value = null;
  }
  loaded.value = true;
}

/**
 * Saves fields of the runner.
 *
 * Args:
 *   data (object): the fields.
 *
 * Returns:
 *   Promise<boolean>: whether they were saved.
 */
async function update(data) {
  try {
    await axios.put(`/api/v2/runner/${encodeURIComponent(runnerId.value)}`, data);
    return true;
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    return false;
  }
}

// ─── tabs ─────────────────────────────────────────────────────────────────────
// the dialog's steps : Runner, Type, Credentials, Connection ; then what runs on it
const tabs = computed(() => [
  { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
  { key: 'type', label: t('settings.runners.stepType'), icon: 'shapes' },
  { key: 'credentials', label: t('settings.runners.stepAuth'), icon: 'key' },
  { key: 'connection', label: t('settings.runners.stepConnection'), icon: 'globe' },
  { key: 'forms', label: t('settings.linked.forms'), icon: 'rectangle-list', count: runnerForms.value.length },
  { key: 'jobs', label: t('settings.linked.jobs'), icon: 'history', count: runnerJobs.value.length },
]);

// ─── Forms and Jobs ───────────────────────────────────────────────────────────
// the forms whose jobs run on it : those that name it, and, the default of its type, those that
// name none ; a row opens the form
const { loadForms, formsOfRunner } = useFormLinks();
const runnerForms = computed(() => formsOfRunner(runner.value));
const formColumns = computed(() => [
  { key: 'name', label: t('settings.fields.form') },
  {
    key: 'how',
    label: t('settings.linked.runsHere'),
    value: (f) => (f.byDefault ? t('settings.linked.asDefault') : t('settings.linked.namesIt')),
  },
  { key: 'description', label: t('settings.fields.description') },
]);
// the jobs that ran on it, the latest first : a multistep job's steps stay under their job
const JOBS_SHOWN = 100;
const jobs = ref([]);
const runnerJobs = computed(() => jobs.value.filter((j) => !j.parent_id));
const jobColumns = computed(() => [
  { key: 'id', label: t('settings.linked.job'), keep: true, class: 'text-end', value: (j) => `#${j.id}` },
  { key: 'form', label: t('settings.fields.form') },
  { key: 'status', label: t('settings.linked.status'), keep: true },
  // its times as the jobs page shows them (the server sends them in its own zone)
  { key: 'start', label: t('jobs.startTime'), keep: true, value: (j) => j.start && Time.format(j.start) },
  { key: 'end', label: t('jobs.endTime'), keep: true, value: (j) => j.end && Time.format(j.end) },
  // how long it ran, as the jobs page says it (a running one : until the tab was loaded), to the
  // right as a number
  {
    key: 'duration',
    label: t('jobs.duration'),
    keep: true,
    class: 'text-end',
    value: (j) => formatDuration(durationSeconds(j)),
  },
]);

/**
 * Loads the jobs that ran on the runner ; refused or failing, the tab stays empty.
 */
async function loadJobs() {
  if (!runner.value?.name) return;
  try {
    const res = await axios.get(`/api/v2/job/?runner=${encodeURIComponent(runner.value.name)}&records=${JOBS_SHOWN}`);
    jobs.value = res.data.records || res.data || [];
  } catch {
    jobs.value = [];
  }
}
const { activeTab, tabLink } = useRouteTab('details', (key) => tabs.value.some((x) => x.key === key));

// the title : Runners › <name>, each step a link
const pageCrumbs = computed(() => [
  { title: t('sidebar.runners'), icon: 'rocket', to: '/settings/runners' },
  {
    title: runner.value?.name || (loaded.value ? runnerId.value : null),
    icon: 'rocket',
    to: `/settings/runners/${runnerId.value}`,
  },
]);
// and the open tab last, as every page in tabs names it : Users › admin › Groups
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...pageCrumbs.value, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : pageCrumbs.value;
});

// the forms it is the default for : those of its type (an awx runner : awx, aap and ascender forms)
const defaultFor = computed(() => t(`settings.runners.default_${runner.value?.type || 'rte'}`));

// ─── actions ──────────────────────────────────────────────────────────────────
/**
 * Saves the fields of every tab, its kind stored as a type and a flavour, as the dialog does.
 */
async function save() {
  const e = edit.value;
  if (!e.name.trim() || !e.uri.trim()) {
    toast.warning(t('settings.runners.fieldsRequired'));
    return;
  }
  const data = {
    name: e.name.trim(),
    description: e.description.trim(),
    uri: e.uri.trim(),
    type: e.kind === 'rte' || PROJECT_RUNNER_KINDS.includes(e.kind) ? e.kind : 'awx',
    project: PROJECT_RUNNER_KINDS.includes(e.kind) ? String(e.project || '').trim() : null,
    flavour: ['aap', 'ascender'].includes(e.kind) ? e.kind : null,
    use_credentials: usesCredentials.value ? 1 : 0,
    username: hasUsername.value ? e.username.trim() : runner.value.username,
    ignore_certs: e.skip_verify ? 1 : 0,
    ca_bundle: !e.skip_verify && e.custom_ca ? e.ca_bundle : '',
  };
  // its new token or password, typed in its Credentials tab
  if (newSecret.value) data[secretKey.value] = newSecret.value;
  if (await update(data)) {
    toast.success(`${data.name} ${t('settings.common.isUpdated')}`);
    newSecret.value = '';
    await load();
  }
}

/**
 * Makes it the default of its kind, saved at once : the one before stops being it.
 */
async function makeDefault() {
  if (await update({ is_default: 1 })) {
    toast.success(`${runner.value.name} ${t('settings.common.isUpdated')}`);
  }
  await load();
}

// Test connection : one at a time
const testing = ref(false);

/**
 * Asks the runner whether it answers, and says so.
 */
async function testConnection() {
  testing.value = true;
  try {
    const result = await axios.post(`/api/v2/runner/${encodeURIComponent(runnerId.value)}/check`, {});
    toast.success(result.data.result);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('admin.connectionFailed')));
  } finally {
    testing.value = false;
  }
}

// its token, or its password with a user and password : typed in its Credentials tab ; empty, the
// stored one is kept
const newSecret = ref('');
const secretKey = computed(() => (usesCredentials.value ? 'password' : 'token'));

// Delete asks first
const confirmDelete = ref(false);

/**
 * Deletes the runner, then goes back to the runners.
 */
async function deleteRunner() {
  confirmDelete.value = false;
  try {
    await axios.delete(`/api/v2/runner/${encodeURIComponent(runnerId.value)}`);
    runner.value = null;
    router.push('/settings/runners');
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await Promise.all([load(), loadForms()]);
  await loadJobs();
});
</script>
<template>
  <BsModal v-if="confirmDelete" size="md" @close="confirmDelete = false" icon="trash">
    <template #title> {{ t('common.delete') }} {{ runner?.name }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">
        {{ t('settings.common.deleteConfirm') }} <strong>{{ runner?.name }}</strong
        >?
      </p>
    </template>
    <template #footer>
      <BsButton icon="trash" @click="deleteRunner()">{{ t('common.delete') }}</BsButton>
    </template>
  </BsModal>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="rocket"
      :title="runner?.name || runnerId"
      :crumbs="crumbs"
      :description="t('settings.runners.description')"
    >
      <template v-if="runner" #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in tabs" :key="tab.key" class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === tab.key }"
              href="#"
              @click.prevent="activeTab = tab.key"
            >
              <FaIcon :icon="tab.icon" class="me-1" />
              {{ tab.label }}
              <span v-if="tab.count !== undefined" class="badge af-tab-count ms-1">{{ tab.count }}</span>
            </a>
          </li>
        </ul>
      </template>
      <!-- the record loading : its tabs as grey placeholders -->
      <template v-else-if="!loaded" #tabs>
        <AppSkeleton shape="tabs" :count="tabs.length" />
      </template>
      <template #default>
        <div v-if="loaded && !runner" class="empty-state">
          <FaIcon icon="rocket" class="empty-state-icon" />
          <span>{{ t('settings.runners.notFound', { id: runnerId }) }}</span>
        </div>
        <!-- the record loading : its fields as grey placeholders, where they come -->
        <AppSkeleton v-else-if="!loaded && !runner" shape="form" :count="3" />
        <!-- Forms : the forms that run on it ; a row opens the form -->
        <AppLinkedTable
          v-else-if="runner && activeTab === 'forms'"
          :columns="formColumns"
          :rows="runnerForms"
          rowKey="name"
          :to="(f) => formPath(f.name)"
          :empty="t('settings.linked.noFormRunner')"
        />
        <!-- Jobs : the jobs that ran on it, the latest first ; a row opens the job -->
        <AppLinkedTable
          v-else-if="runner && activeTab === 'jobs'"
          :columns="jobColumns"
          :rows="runnerJobs"
          :to="(j) => `/jobs/${j.id}`"
          :empty="t('settings.linked.noJob')"
        >
          <template #cell-status="{ row }"><AppStatusPill :status="row.status" /></template>
        </AppLinkedTable>
        <div v-else-if="runner && edit" class="af-runner-tab">
          <!-- a runner of the config seed : read only here -->
          <div v-if="managed" class="alert alert-secondary py-2">
            <FaIcon icon="lock" class="me-2" />{{ t('settings.common.seedManagedNotice') }}
          </div>
          <fieldset :disabled="readOnly">
            <!-- Details : its registration, what it is called, whether it is the default -->
            <template v-if="activeTab === 'details'">
              <div class="mb-3">
                <div class="form-label fw-bold">{{ t('settings.runners.state') }}</div>
                <span v-html="registrationPill(t, runner.state)"></span>
              </div>
              <BsInput
                class="af-runner-field"
                v-model="edit.name"
                icon="heading"
                :isFloating="false"
                :required="true"
                :help="t('settings.runners.nameHelp')"
                :label="t('settings.fields.name')"
              />
              <BsInput
                class="af-runner-field"
                v-model="edit.description"
                icon="info-circle"
                :isFloating="false"
                :label="t('settings.fields.description')"
              />
              <div class="mb-3">
                <label class="form-label fw-bold d-block" for="af-runner-default">{{
                  t('settings.runners.isDefault')
                }}</label>
                <!-- turned on, saved at once ; turned off by making another the default -->
                <div class="form-check form-switch mb-0">
                  <input
                    id="af-runner-default"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    :checked="!!runner.is_default"
                    :disabled="!!runner.is_default"
                    @change="makeDefault()"
                  />
                </div>
                <div class="form-text">{{ t('settings.runners.defaultHelp', { forms: defaultFor }) }}</div>
              </div>
            </template>
            <!-- Type : RTE, AWX, AAP, Ascender, Semaphore or Rundeck, each its label and a few grey words -->
            <template v-else-if="activeTab === 'type'">
              <div v-for="kind in RUNNER_KINDS" :key="kind" class="form-check af-short-check">
                <input
                  :id="'af-kind-' + kind"
                  v-model="edit.kind"
                  class="form-check-input"
                  type="radio"
                  name="af-runner-kind"
                  :value="kind"
                  :disabled="!kindAllowed(kind)"
                />
                <label class="form-check-label" :for="'af-kind-' + kind">
                  <span class="af-short-label">{{ t(`settings.runners.type_${kind}`) }}</span>
                  <span class="text-body-secondary small">{{ t(`settings.runners.type_${kind}Hint`) }}</span>
                </label>
              </div>
            </template>
            <!-- Connection : where it is, and how its certificate is checked -->
            <template v-else-if="activeTab === 'connection'">
              <BsInput
                class="af-runner-field"
                v-model="edit.uri"
                icon="globe"
                :placeholder="URI_EXAMPLE[edit.kind]"
                :isFloating="false"
                :required="true"
                :help="t(`settings.runners.uriHelp_${edit.kind}`)"
                :label="t('settings.fields.uri')"
              />
              <BsInput
                v-if="hasProject"
                class="af-runner-field"
                v-model="edit.project"
                icon="folder"
                :isFloating="false"
                :required="!isJenkins"
                :help="t(`settings.runners.projectHelp_${edit.kind}`)"
                :label="t('settings.runners.project')"
              />
              <div class="form-check form-switch mb-3">
                <input
                  id="af-runner-skip"
                  v-model="edit.skip_verify"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  @change="edit.skip_verify && (edit.custom_ca = false)"
                />
                <label class="form-check-label" for="af-runner-skip">{{ t('settings.runners.skipVerify') }}</label>
              </div>
              <div v-if="!edit.skip_verify" class="form-check form-switch mb-3">
                <input
                  id="af-runner-ca"
                  v-model="edit.custom_ca"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                />
                <label class="form-check-label" for="af-runner-ca">{{ t('settings.runners.customCa') }}</label>
              </div>
              <BsInput
                v-if="!edit.skip_verify && edit.custom_ca"
                class="af-runner-field"
                v-model="edit.ca_bundle"
                type="textarea"
                icon="certificate"
                placeholder="-----BEGIN CERTIFICATE-----"
                :isFloating="false"
                :help="t('settings.runners.caBundleHelp')"
                :label="t('settings.fields.caBundle')"
              />
            </template>
            <!-- Authentication : an RTE's, a Semaphore's or a Rundeck's token, a Jenkins' user and
                 its token ; an AWX's token, or a user and password -->
            <template v-else>
              <template v-if="isAwxKind">
                <div
                  v-for="opt in [
                    {
                      value: false,
                      label: t('settings.runners.authToken'),
                      hint: t('settings.runners.authTokenHint'),
                    },
                    { value: true, label: t('settings.runners.authUser'), hint: t('settings.runners.authUserHint') },
                  ]"
                  :key="String(opt.value)"
                  class="form-check af-short-check"
                >
                  <input
                    :id="'af-auth-' + opt.value"
                    v-model="edit.use_credentials"
                    class="form-check-input"
                    type="radio"
                    name="af-runner-auth"
                    :value="opt.value"
                  />
                  <label class="form-check-label" :for="'af-auth-' + opt.value">
                    <span class="af-short-label">{{ opt.label }}</span>
                    <span class="text-body-secondary small">{{ opt.hint }}</span>
                  </label>
                </div>
              </template>
              <BsInput
                v-if="hasUsername"
                class="af-runner-field"
                :class="{ 'mt-3': usesCredentials }"
                v-model="edit.username"
                icon="user"
                :isFloating="false"
                :help="isJenkins ? t('settings.runners.usernameHelp_jenkins') : ''"
                :label="t('settings.fields.username')"
              />
              <p v-if="hasProject" class="form-text mb-2">{{ t(`settings.runners.tokenHelp_${edit.kind}`) }}</p>
              <!-- its token or password, masked : left empty, the stored one is kept ; typed, replaced -->
              <BsInput
                class="af-runner-field"
                :class="{ 'mt-3': isAwxKind && !usesCredentials }"
                v-model="newSecret"
                type="password"
                :icon="usesCredentials ? 'lock' : 'key'"
                :isFloating="false"
                placeholder="**********"
                :disabled="readOnly"
                :help="
                  usesCredentials
                    ? t('settings.common.passwordKeep')
                    : t(`settings.runners.tokenKeep_${isRte ? 'rte' : 'api'}`)
                "
                :label="usesCredentials ? t('settings.fields.password') : t('settings.fields.token')"
              />
            </template>
          </fieldset>
        </div>
      </template>
      <template v-if="runner" #actions>
        <BsButton icon="plug" cssClass="text-nowrap" :disabled="testing" @click="testConnection()">{{
          t('settings.common.testConnection')
        }}</BsButton>
        <template v-if="!readOnly">
          <BsButton icon="trash" @click="confirmDelete = true">{{ t('common.delete') }}</BsButton>
          <BsButton icon="save" :disabled="!dirty" @click="save()">{{ t('settings.common.save') }}</BsButton>
        </template>
      </template>
      <!-- the record loading : its buttons as grey placeholders, so the title line keeps its
           height and nothing moves when they come -->
      <template v-else-if="!loaded" #actions>
        <AppSkeleton shape="buttons" :widths="recordButtons('runners', runnerId, appStore.isAdmin)" />
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the count of a tab : small and grey, as the menus' badges */
.af-tab-count {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  font-weight: 600;
}
/* the wide fields' width of the settings pages, as a user's and a repository's */
.af-runner-field :deep(.input-group) {
  max-width: 40rem;
}
/* the tab ends a little above the card's edge, as every record's page (24px in all) */
.af-runner-tab {
  padding-bottom: 0.5rem;
}
/* the fields sit in a fieldset (read only for the config seed's runners) : the card cannot reach
   its last field's margin to zero it, so it is zeroed here */
.af-runner-tab fieldset > :last-child,
.af-runner-tab fieldset > :last-child :deep(.mb-3:last-child) {
  margin-bottom: 0 !important;
}
/* the radio buttons : their labels one width, so the grey hints line up, as in the dialog */
.af-short-check {
  margin-bottom: 0.6rem;
}
.af-short-label {
  display: inline-block;
  min-width: 12rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
