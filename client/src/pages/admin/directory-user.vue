<script setup>
/******************************************************************/
/*                                                                */
/*  An LDAP or SSO user's page (/settings/users/<source>/<name>), */
/*  opened from the users list : what was recorded at its last    */
/*  sign-in (models/directoryUser.model.js on the server), read   */
/*  only - its directory owns who it is and its groups - in tabs, */
/*  the tab kept in the address ; a row of a tab opens its item : */
/*  Details - username, source, name, email, first seen, last     */
/*            sign-in                                             */
/*  Groups - the groups it had at its last sign-in                */
/*  Roles - the roles it has, and how                             */
/*  Forms, Jobs, Stored jobs, Schedules, Activity - as a local    */
/*          user's (composables/useUserLinks.js)                  */
/*  Its Sign-in switch in Details (off : blocked, asked first) ;  */
/*  End sessions and Forget top right.                            */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import { formPath } from '@/lib/formsPath';
import { sourceLabel } from '@/config/settings';
import { setSignInBlocked } from '@/lib/signIn';
import { useRouteTab } from '@/composables/useRouteTab';
import { useRoleAssignments } from '@/composables/useRoleAssignments';
import { useFormLinks } from '@/composables/useFormLinks';
import { useUserLinks } from '@/composables/useUserLinks';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authenticated = ref(false);
const loaded = ref(false);

// ─── the user ─────────────────────────────────────────────────────────────────
const source = computed(() => String(route.params.type || ''));
const username = computed(() => String(route.params.name || ''));
const user = ref(null); // its record : { username, description, email, groups, seen, blocked, ... }
const sourceName = computed(() => sourceLabel(t, source.value));
// the address of the api for this user
const apiPath = computed(
  () => `/api/v2/directory/users/${encodeURIComponent(source.value)}/${encodeURIComponent(username.value)}`,
);

/**
 * Loads the user's record ; none when it was neither seen nor named by a role.
 */
async function load() {
  try {
    const res = await axios.get(apiPath.value);
    user.value = res.data.records ? res.data.records[0] : res.data;
  } catch {
    user.value = null;
  }
  loaded.value = true;
}

// its groups at its last sign-in, written source/name : the name alone, each opening its page
const userGroups = computed(() =>
  (user.value?.groups || []).map((g) => {
    const name = String(g).slice(String(g).indexOf('/') + 1);
    return { id: g, name };
  }),
);

// ─── Roles, Forms ─────────────────────────────────────────────────────────────
// the roles it has, by the login's rule on the groups of its last sign-in ; a row opens the role
const { loadRoles, rolesOfUser } = useRoleAssignments();
const userRoles = computed(() =>
  user.value
    ? rolesOfUser(
        user.value.username,
        userGroups.value.map((g) => g.name),
        source.value,
      )
    : [],
);
/**
 * How a role is the user's, in words : directly, through which groups, or everyone's.
 *
 * Args:
 *   r (object): a row of userRoles.
 *
 * Returns:
 *   string: the Given by cell.
 */
function givenBy(r) {
  if (r.everyone) return t('settings.common.roleEveryone');
  const parts = [];
  if (r.direct) parts.push(t('settings.common.roleDirectly'));
  if (r.groups.length) parts.push(t('settings.common.roleThroughGroups', { groups: r.groups.join(', ') }));
  return parts.join(' · ');
}
const roleColumns = computed(() => [
  { key: 'name', label: t('settings.common.role') },
  { key: 'given', label: t('settings.common.roleGivenBy'), value: givenBy },
  { key: 'description', label: t('settings.fields.description') },
]);
// the forms its roles open (the admin role, every form) ; a row opens the form
const { loadForms, formsOfRoles } = useFormLinks();
const userForms = computed(() => formsOfRoles(userRoles.value.map((r) => r.name)));
const formColumns = computed(() => [
  { key: 'name', label: t('settings.fields.form') },
  { key: 'through', label: t('settings.linked.throughRoles'), value: (f) => f.through.join(', ') },
  { key: 'description', label: t('settings.fields.description') },
]);
const groupColumns = computed(() => [{ key: 'name', label: t('settings.fields.name') }]);

// what it launched, keeps and did, as a local user's page shows it
const who = computed(() => (user.value ? { type: source.value, username: user.value.username } : null));
const {
  jobs,
  storedJobs,
  schedules,
  activity,
  loadUserLinks,
  jobColumns,
  storedJobColumns,
  scheduleColumns,
  activityColumns,
} = useUserLinks(who);

// ─── tabs ─────────────────────────────────────────────────────────────────────
const tabs = computed(() => [
  { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
  { key: 'groups', label: t('settings.settingsPage.groups'), icon: 'users', count: userGroups.value.length },
  { key: 'roles', label: t('settings.settingsPage.roles'), icon: 'user-shield', count: userRoles.value.length },
  { key: 'forms', label: t('settings.linked.forms'), icon: 'rectangle-list', count: userForms.value.length },
  { key: 'jobs', label: t('settings.linked.jobs'), icon: 'history', count: jobs.value.length },
  {
    key: 'stored-jobs',
    label: t('settings.storedJobs.labelPlural'),
    icon: 'floppy-disk',
    count: storedJobs.value.length,
  },
  { key: 'schedules', label: t('settings.schedules.labelPlural'), icon: 'clock', count: schedules.value.length },
  { key: 'activity', label: t('settings.linked.activity'), icon: 'clipboard-list', count: activity.value.length },
]);
const { activeTab, tabLink } = useRouteTab('details', (key) => tabs.value.some((x) => x.key === key));

// the title : Users › <name>, each step a link, and the open tab last
const pagePath = computed(
  () => `/settings/users/${encodeURIComponent(source.value)}/${encodeURIComponent(username.value)}`,
);
const crumbs = computed(() => {
  const base = [
    { title: t('settings.users.labelPlural'), icon: 'user', to: '/settings/users' },
    { title: user.value?.username || username.value, icon: 'user', to: pagePath.value },
  ];
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...base, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : base;
});

// ─── Details ──────────────────────────────────────────────────────────────────
// what was recorded, as read-only fields : a date in the user's zone, an en dash for none
const when = (v) => (v ? Helpers.formatServerDate(v) : '–');
const details = computed(() =>
  user.value
    ? [
        { key: 'username', icon: 'user', label: t('settings.fields.username'), value: user.value.username },
        { key: 'source', icon: 'right-to-bracket', label: t('settings.directory.source'), value: sourceName.value },
        {
          key: 'name',
          icon: 'id-card',
          label: t('settings.directory.displayName'),
          value: user.value.description || '–',
        },
        { key: 'email', icon: 'envelope', label: t('settings.fields.email'), value: user.value.email || '–' },
        {
          key: 'first',
          icon: 'calendar',
          label: t('settings.directory.firstSeen'),
          value: when(user.value.first_seen),
        },
        {
          key: 'last',
          icon: 'clock',
          label: t('settings.directory.lastLogin'),
          value: user.value.seen ? when(user.value.last_login) : t('settings.directory.neverSignedIn'),
        },
      ]
    : [],
);

// ─── actions ──────────────────────────────────────────────────────────────────
// Block asks first (its sessions end at once) ; Forget asks first ; Allow and End sessions do not
const confirming = ref(null); // 'block' or 'forget' while its dialog is open

/**
 * Calls the api, then reloads the record ; a refusal is said in a toast.
 *
 * Args:
 *   method (string): post or delete.
 *   path (string): after the user's api address ('' for the user itself).
 *   body (object): the request's body.
 *   done (string): what the toast says once done.
 *
 * Returns:
 *   Promise<boolean>: whether it was done.
 */
async function act(method, path, body, done) {
  try {
    await axios[method](apiPath.value + path, body);
    toast.success(done);
    return true;
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    return false;
  }
}

/**
 * Blocks or allows the user's sign-in.
 *
 * Args:
 *   blocked (boolean): true to block.
 */
async function setBlocked(blocked) {
  confirming.value = null;
  const name = user.value.username;
  const done = blocked ? t('settings.directory.nowBlocked', { name }) : t('settings.directory.nowAllowed', { name });
  try {
    await setSignInBlocked({ source: source.value, username: user.value.username }, blocked);
    toast.success(done);
    await load();
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

/**
 * The Sign-in switch turned : on allows at once ; off asks first (its sessions end), the switch
 * staying on until confirmed.
 *
 * Args:
 *   event (Event): the switch's change.
 */
function onSignInSwitch(event) {
  if (event.target.checked) {
    setBlocked(false);
    return;
  }
  event.target.checked = true;
  confirming.value = 'block';
}

/**
 * Ends the user's sessions : it signs in again.
 */
async function endSessions() {
  await act('post', '/end-sessions', {}, t('settings.directory.sessionsEnded', { name: user.value.username }));
}

/**
 * Forgets the user's record, then goes back to the list.
 */
async function forget() {
  confirming.value = null;
  if (await act('delete', '', undefined, t('settings.directory.forgotten', { name: user.value.username }))) {
    router.push('/settings/users');
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await Promise.all([load(), loadRoles(), loadForms()]);
  await loadUserLinks();
});
</script>
<template>
  <AppBlockSignInDialog
    v-if="confirming === 'block'"
    :name="user?.username || username"
    @confirm="setBlocked(true)"
    @close="confirming = null"
  />
  <BsModal v-if="confirming === 'forget'" size="md" @close="confirming = null" icon="eraser">
    <template #title> {{ t('settings.directory.forget') }} {{ user?.username }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">{{ t('settings.directory.forgetConfirm', { name: user?.username }) }}</p>
    </template>
    <template #footer>
      <BsButton icon="eraser" @click="forget()">{{ t('settings.directory.forget') }}</BsButton>
    </template>
  </BsModal>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="user"
      :title="user?.username || username"
      :crumbs="crumbs"
      :description="t('settings.users.description')"
    >
      <template v-if="user" #tabs>
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
      <template #default>
        <div v-if="loaded && !user" class="empty-state">
          <FaIcon icon="user" class="empty-state-icon" />
          <span>{{ t('settings.directory.notFound', { name: username, source: sourceName }) }}</span>
        </div>
        <!-- Details : what was recorded at its last sign-in, read only -->
        <div v-else-if="user && activeTab === 'details'" class="af-user-details">
          <div v-if="!user.seen" class="alert alert-secondary py-2">
            <FaIcon icon="circle-info" class="me-2" />{{ t('settings.directory.neverNote') }}
          </div>
          <div v-else class="alert alert-secondary py-2">
            <FaIcon icon="circle-info" class="me-2" />{{ t('settings.directory.readOnlyNote', { source: sourceName }) }}
          </div>
          <!-- Sign-in : allowed, or blocked by an admin ; saved at once, as a runner's Default -->
          <div class="mb-3">
            <label class="form-label fw-bold d-block" for="af-sign-in">{{ t('settings.directory.allowSignIn') }}</label>
            <div class="form-check form-switch mb-0">
              <input
                id="af-sign-in"
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="!user.blocked"
                @change="onSignInSwitch"
              />
            </div>
            <div class="form-text">
              {{
                user.blocked
                  ? t('settings.directory.blockedNote')
                  : t('settings.directory.signInHelp', { source: sourceName })
              }}
            </div>
          </div>
          <BsInput
            v-for="d in details"
            :key="d.key"
            class="af-user-field"
            :modelValue="d.value"
            :icon="d.icon"
            :isFloating="false"
            :disabled="true"
            :label="d.label"
          />
        </div>
        <!-- Groups : those of its last sign-in ; a row opens the group -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'groups'"
          :columns="groupColumns"
          :rows="userGroups"
          :to="(g) => `/settings/groups/${encodeURIComponent(source)}/${encodeURIComponent(g.name)}`"
          :empty="t('settings.directory.noGroupSeen')"
        />
        <!-- Roles : the roles it has, and how (public always) ; a row opens the role -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'roles'"
          :columns="roleColumns"
          :rows="userRoles"
          rowKey="name"
          :to="(r) => `/settings/roles/${encodeURIComponent(r.name)}`"
        />
        <AppLinkedTable
          v-else-if="user && activeTab === 'forms'"
          :columns="formColumns"
          :rows="userForms"
          rowKey="name"
          :to="(f) => formPath(f.name)"
          :empty="t('settings.linked.noFormUser')"
        />
        <AppLinkedTable
          v-else-if="user && activeTab === 'jobs'"
          :columns="jobColumns"
          :rows="jobs"
          :to="(j) => `/jobs/${j.id}`"
          :empty="t('settings.linked.noJob')"
        >
          <template #cell-status="{ row }"><AppStatusPill :status="row.status" /></template>
        </AppLinkedTable>
        <AppLinkedTable
          v-else-if="user && activeTab === 'stored-jobs'"
          :columns="storedJobColumns"
          :rows="storedJobs"
          :to="(j) => `/jobs/stored/${j.id}`"
          :empty="t('settings.users.noStoredJob')"
        />
        <AppLinkedTable
          v-else-if="user && activeTab === 'schedules'"
          :columns="scheduleColumns"
          :rows="schedules"
          :to="(s) => `/jobs/schedules/${s.id}`"
          :empty="t('settings.users.noSchedule')"
        />
        <AppLinkedTable
          v-else-if="user && activeTab === 'activity'"
          :columns="activityColumns"
          :rows="activity"
          :empty="t('settings.linked.noActivity')"
        />
      </template>
      <template v-if="user" #actions>
        <BsButton icon="right-from-bracket" :disabled="!user.seen" @click="endSessions()">{{
          t('settings.directory.endSessions')
        }}</BsButton>
        <!-- a blocked user is kept : forgetting it would let it in ; one never seen has nothing -->
        <BsButton icon="eraser" :disabled="user.blocked || !user.seen" @click="confirming = 'forget'">{{
          t('settings.directory.forget')
        }}</BsButton>
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the wide fields' width of the settings pages, as a local user's */
.af-user-field :deep(.input-group) {
  max-width: 40rem;
}
.af-user-details {
  padding-bottom: 0.5rem;
}
/* the count of a tab : small and grey, as the menus' badges */
.af-tab-count {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  font-weight: 600;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
