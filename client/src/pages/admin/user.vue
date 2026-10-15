<script setup>
/******************************************************************/
/*                                                                */
/*  A local user's page (/settings/users/<id>), opened from the   */
/*  users list, in tabs, the tab kept in the address              */
/*  (/groups, /roles...) ; a row of a tab opens its item :        */
/*  Details - its Allow sign-in switch (off : blocked, asked      */
/*            first), username, description, email               */
/*  Groups - the groups it belongs to : Add group, and a row's    */
/*           menu or the checkboxes remove one, never the last    */
/*  Roles - the roles it has, and how (by name, through a group,  */
/*          default as everyone's)                                */
/*  Forms - the forms its roles open                              */
/*  Jobs - the jobs it launched, the latest first                 */
/*  Stored jobs - the form values it stored to run again          */
/*  Schedules - the jobs it planned with Run later                */
/*  Activity - what the audit log recorded it doing               */
/*  Change password and Delete top right, as the list's row menu  */
/*  has them.                                                     */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import { formPath } from '@/lib/formsPath';
import { useFormLinks } from '@/composables/useFormLinks';
import { useUserLinks } from '@/composables/useUserLinks';
import BsDataTable from '@/components/BsDataTable.vue';
import { setSignInBlocked } from '@/lib/signIn';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';
import { useRoleAssignments } from '@/composables/useRoleAssignments';
import { useRoleMembership } from '@/composables/useRoleMembership';
import { recordButtons } from '@/lib/recordButtons';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authenticated = ref(false);
const loaded = ref(false);
// how many API tokens it has : the count of its tab, read at once (its table reads them only when
// its tab is open, and says the count again after a revoke)
const tokenCount = ref(null);

// ─── the user and the groups ──────────────────────────────────────────────────
const userId = computed(() => String(route.params.id || ''));
const user = ref(null); // as saved
const edit = ref(null); // as edited : username, description, email
const groups = ref([]); // every local group : { id, name, description }

// the admin user : the way back in, never deleted or renamed (the server refuses both)
const isAdminUser = computed(() => user.value?.username === 'admin');

const dirty = computed(
  () =>
    !!user.value &&
    !!edit.value &&
    ['username', 'description', 'email'].some((k) => (edit.value[k] || '') !== (user.value[k] || '')),
);
// leaving with the details changed and unsaved asks first
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => saveDetails(),
);

// the groups the user belongs to : its first (group_id) and the others (group_ids)
const userGroups = computed(() => {
  const ids = user.value?.group_ids || (user.value ? [user.value.group_id] : []);
  return groups.value.filter((g) => ids.includes(g.id));
});

/**
 * Loads the user and the local groups.
 */
async function load() {
  try {
    const [u, g] = await Promise.all([
      axios.get(`/api/v2/user/${encodeURIComponent(userId.value)}`),
      axios.get('/api/v2/group/'),
    ]);
    const record = u.data.records ? u.data.records[0] : u.data;
    user.value = record || null;
    edit.value = record
      ? { username: record.username || '', description: record.description || '', email: record.email || '' }
      : null;
    groups.value = (g.data.records || g.data).map((x) => ({ id: x.id, name: x.name, description: x.description }));
  } catch {
    user.value = null;
  }
  loaded.value = true;
}

/**
 * Saves fields of the user. The password is never sent from here but by Change password : the
 * one the api returns is masked, and sending it back would store the mask.
 *
 * Args:
 *   data (object): the fields to save.
 *
 * Returns:
 *   Promise<boolean>: whether it was saved.
 */
async function update(data) {
  try {
    await axios.put(`/api/v2/user/${encodeURIComponent(userId.value)}`, data);
    return true;
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    return false;
  }
}

// ─── Forms, Jobs, Stored jobs, Schedules, Activity ─────────────────────────────
// the forms its roles open (the admin role, every form) ; a row opens the form
const { loadForms, formsOfRoles } = useFormLinks();
const userForms = computed(() => formsOfRoles(userRoles.value.map((r) => r.name)));
const formColumns = computed(() => [
  { key: 'name', label: t('settings.fields.form') },
  { key: 'through', label: t('settings.linked.throughRoles'), value: (f) => f.through.join(', ') },
  { key: 'description', label: t('settings.fields.description') },
]);
// what it launched, keeps and did (composables/useUserLinks.js), as an LDAP or SSO user's page
const who = computed(() => (user.value ? { type: 'local', username: user.value.username } : null));
const {
  jobs: userJobs,
  storedJobs: userStoredJobs,
  schedules: userSchedules,
  activity,
  loadUserLinks,
  jobColumns,
  stepsOf,
  storedJobColumns,
  scheduleColumns,
  activityColumns,
} = useUserLinks(who);

// ─── tabs ─────────────────────────────────────────────────────────────────────
// Details (username, description, email) first, then the others by their name (Activity, API
// tokens, Forms, Groups, Jobs, Roles, Schedules, Stored jobs in English) ; the tab kept in the url
const tabs = computed(() => [
  { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
  ...otherTabs.value.slice().sort((a, b) => a.label.localeCompare(b.label)),
]);
const otherTabs = computed(() => [
  { key: 'groups', label: t('settings.settingsPage.groups'), icon: 'users', count: userGroups.value.length },
  { key: 'roles', label: t('settings.settingsPage.roles'), icon: 'user-shield', count: userRoles.value.length },
  { key: 'forms', label: t('settings.linked.forms'), icon: 'rectangle-list', count: userForms.value.length },
  { key: 'jobs', label: t('settings.linked.jobs'), icon: 'history', count: userJobs.value.length },
  {
    key: 'stored-jobs',
    label: t('settings.storedJobs.labelPlural'),
    icon: 'floppy-disk',
    count: userStoredJobs.value.length,
  },
  { key: 'schedules', label: t('settings.schedules.labelPlural'), icon: 'clock', count: userSchedules.value.length },
  { key: 'activity', label: t('settings.linked.activity'), icon: 'clipboard-list', count: activity.value.length },
  // its api tokens, each to revoke (#1068)
  { key: 'tokens', label: t('apiTokens.tab'), icon: 'code', count: tokenCount.value },
]);

// ─── Roles ────────────────────────────────────────────────────────────────────
// the roles the user has : by its name, through its groups, default as everyone's ; a row opens
// the role's page
const { loadRoles, rolesOfUser } = useRoleAssignments();

// ─── Add role / Remove from role ──────────────────────────────────────────────
// Add role names it in a role of the forms config ; the roles ticked are taken out of those
// named in by its own name (not those through a group, nor default : everyone's) ; both saved at once, as the roles' pages save
const { roleNames, readOnly: rolesReadOnly, addTo, removeFrom } = useRoleMembership();
const addingRole = ref(false);
// the roles it can be added to : those it is not named in yet
const roleChoices = computed(() => {
  const named = new Set(userRoles.value.filter((r) => r.direct).map((r) => r.name));
  return roleNames.value.filter((n) => !named.has(n));
});
/**
 * Names it in the role picked, then reads the roles again.
 *
 * Args:
 *   roleName (string): the role.
 */
async function addRole(roleName) {
  if (await addTo(roleName, 'users', 'local', user.value.username)) {
    addingRole.value = false;
    await loadRoles();
  }
}
/**
 * Takes it out of the roles ticked that name it, then reads the roles again.
 *
 * Args:
 *   rows (object[]): the rows ticked.
 */
async function removeRoles(rows) {
  const names = rows.filter((r) => r.direct).map((r) => r.name);
  if (names.length && (await removeFrom(names, 'users', 'local', user.value.username))) await loadRoles();
}
const userRoles = computed(() =>
  user.value
    ? rolesOfUser(
        user.value.username,
        userGroups.value.map((g) => g.name),
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
// the rows of the page shown of the Groups and Roles tables (their pager under them)
// its table : the role (a row opens it), how the user has it, what it is for
const roleColumns = computed(() => [
  { key: 'name', label: t('settings.common.role') },
  { key: 'given', label: t('settings.common.roleGivenBy'), value: (r) => givenBy(r) },
  { key: 'description', label: t('settings.fields.description') },
]);
const { activeTab, tabLink } = useRouteTab('details', (key) => tabs.value.some((x) => x.key === key));

// the title : Users › <username>, each step a link : Users back to the list, the name to this page
const pageCrumbs = computed(() => [
  { title: t('settings.users.labelPlural'), icon: 'user', to: '/settings/users' },
  {
    title: user.value?.username || (loaded.value ? userId.value : null),
    icon: 'user',
    to: `/settings/users/${userId.value}`,
  },
]);
// and the open tab last, as every page in tabs names it : Users › admin › Groups
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...pageCrumbs.value, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : pageCrumbs.value;
});

// ─── Details ──────────────────────────────────────────────────────────────────
const emailValid = computed(() => !edit.value?.email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(edit.value.email));

/**
 * Saves the details : username, description and email.
 */
async function saveDetails() {
  if (!edit.value.username.trim()) {
    toast.warning(t('settings.users.usernameRequired'));
    return;
  }
  if (!emailValid.value) {
    toast.warning(t('settings.users.emailInvalid'));
    return;
  }
  const data = {
    username: edit.value.username.trim(),
    description: edit.value.description.trim(),
    email: edit.value.email.trim(),
  };
  if (await update(data)) {
    toast.success(`${data.username} ${t('settings.common.isUpdated')}`);
    await load();
  }
}

// ─── Add group / remove groups ────────────────────────────────────────────────
// Add group : a dialog with the groups the user is not in yet ; saved at once. Removing (a row's
// menu, or the rows ticked) is saved at once too ; a user keeps at least one group.
const addingGroup = ref(null); // the group id picked, null while the dialog is closed
const selectedGroups = ref(new Set()); // the group rows ticked (their id)
// the Groups table's controls (its search, Select all, columns, export) on the title line, its
// pager under the card, as every list
const toolsId = `af-tools-${Math.random().toString(36).slice(2, 10)}`;
const pagerId = `af-pager-${Math.random().toString(36).slice(2, 10)}`;
// none : an en dash, as the other empty cells
const groupColumns = computed(() => [
  { key: 'name', label: t('settings.fields.name'), filterable: true },
  { key: 'description', label: t('settings.fields.description'), filterable: true },
]);
const freeGroups = computed(() => groups.value.filter((g) => !userGroups.value.some((u) => u.id === g.id)));

/**
 * Adds the user to the group picked.
 */
async function saveAddGroup() {
  try {
    await axios.post(`/api/v2/user/${encodeURIComponent(userId.value)}/groups`, { group_id: addingGroup.value });
    addingGroup.value = null;
    await load();
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

/**
 * Removes the user from groups, one after the other ; the server refuses the last one.
 *
 * Args:
 *   ids (number[]): the groups.
 */
async function removeGroups(ids) {
  for (const gid of ids) {
    try {
      await axios.delete(`/api/v2/user/${encodeURIComponent(userId.value)}/groups/${gid}`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
      break;
    }
  }
  selectedGroups.value = new Set();
  await load();
}

// ─── Change password ──────────────────────────────────────────────────────────
const changingPassword = ref(false); // the Change password dialog open (AppChangePasswordDialog)

/**
 * Saves the new password, typed twice in the dialog ; the server hashes it.
 *
 * Args:
 *   password (string): the new password.
 */
async function savePassword(password) {
  if (await update({ password })) {
    changingPassword.value = false;
    toast.success(t('settings.users.passwordChanged'));
  }
}

// ─── Allow sign-in ────────────────────────────────────────────────────────────
// on : it signs in ; off : blocked, its sessions end and every sign-in is refused (asked first,
// the switch staying on until confirmed). Never the admin user, the way back in.
const confirmBlock = ref(false);

/**
 * The Allow sign-in switch turned : on allows at once ; off asks first.
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
  confirmBlock.value = true;
}

/**
 * Blocks or allows the user's sign-in, then reloads it ; a refusal (its own sign-in) in a toast.
 *
 * Args:
 *   blocked (boolean): true to block.
 */
async function setBlocked(blocked) {
  confirmBlock.value = false;
  const name = user.value.username;
  try {
    await setSignInBlocked({ id: userId.value, username: name, source: 'local' }, blocked);
    toast.success(
      blocked ? t('settings.directory.nowBlocked', { name }) : t('settings.directory.nowAllowed', { name }),
    );
    await load();
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
const confirmDelete = ref(false);

/**
 * Deletes the user, then goes back to the list.
 */
async function deleteUser() {
  confirmDelete.value = false;
  try {
    await axios.delete(`/api/v2/user/${encodeURIComponent(userId.value)}`);
    router.push('/settings/users');
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

// how many API tokens it has (loadTokenCount)
/**
 * Reads how many API tokens the user has ; unknown on an error (no count shown).
 */
async function loadTokenCount() {
  const res = await axios.get(`/api/v2/user/${encodeURIComponent(userId.value)}/tokens`).catch(() => null);
  tokenCount.value = res ? (res.data?.records || []).length : null;
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await Promise.all([load(), loadRoles(), loadForms()]);
  await loadUserLinks();
  loadTokenCount();
  // opened from the list's Add to group : the dialog open at once, the url left clean
  if (route.query.add && user.value) {
    // in every group already : the dialog says so, its Save off
    addingGroup.value = freeGroups.value[0]?.id ?? '';
    const query = { ...route.query };
    delete query.add;
    router.replace({ path: route.path, query });
  }
});
</script>
<template>
  <AppAddRoleDialog v-if="addingRole" :choices="roleChoices" @save="addRole" @close="addingRole = false" />
  <AppBlockSignInDialog
    v-if="confirmBlock"
    :name="user?.username || ''"
    @confirm="setBlocked(true)"
    @close="confirmBlock = false"
  />
  <BsModal v-if="confirmDelete" size="md" @close="confirmDelete = false" icon="trash">
    <template #title> {{ t('common.delete') }} {{ user?.username }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">
        {{ t('settings.common.deleteConfirm') }} <strong>{{ user?.username }}</strong
        >?
      </p>
    </template>
    <template #footer>
      <BsButton icon="trash" @click="deleteUser()">{{ t('common.delete') }}</BsButton>
    </template>
  </BsModal>
  <BsModal v-if="addingGroup !== null" size="md" @close="addingGroup = null" icon="users">
    <template #title> {{ t('settings.settingsPage.addGroup') }} </template>
    <template #default>
      <label class="form-label fw-bold">{{ t('settings.fields.group') }}</label>
      <select v-model="addingGroup" class="form-select">
        <option v-for="g in freeGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      <div v-if="!freeGroups.length" class="text-muted small mt-1">{{ t('settings.users.inEveryGroup') }}</div>
    </template>
    <template #footer>
      <BsButton icon="save" :disabled="!addingGroup" @click="saveAddGroup()">{{ t('settings.common.save') }}</BsButton>
    </template>
  </BsModal>
  <!-- the Change password dialog of the users list, the same component -->
  <AppChangePasswordDialog v-if="changingPassword" icon="user" @save="savePassword" @close="changingPassword = false" />
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="user"
      :title="user?.username || userId"
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
      <!-- the record loading : its tabs as grey placeholders -->
      <template v-else-if="!loaded" #tabs>
        <AppSkeleton shape="tabs" :count="tabs.length" />
      </template>
      <template #default>
        <div v-if="loaded && !user" class="empty-state">
          <FaIcon icon="user" class="empty-state-icon" />
          <span>{{ t('settings.users.userNotFound', { id: userId }) }}</span>
        </div>
        <!-- the record loading : its fields as grey placeholders, where they come -->
        <AppSkeleton v-else-if="!loaded && !user" shape="form" :count="3" />
        <!-- Details : the username, its description and email, then whether it may sign in -->
        <div v-else-if="user && activeTab === 'details'" class="af-user-details">
          <BsInput
            class="af-user-field"
            v-model="edit.username"
            icon="user"
            :isFloating="false"
            :required="true"
            :disabled="isAdminUser"
            :label="t('settings.fields.username')"
          />
          <BsInput
            class="af-user-field"
            v-model="edit.description"
            icon="info-circle"
            :isFloating="false"
            :label="t('settings.fields.description')"
          />
          <BsInput
            class="af-user-field"
            v-model="edit.email"
            icon="envelope"
            :isFloating="false"
            :hasError="!emailValid"
            :label="t('settings.fields.email')"
          />
          <!-- Allow sign-in : saved at once, as a runner's Default ; never off for the admin user -->
          <div class="mb-0">
            <label class="form-label fw-bold d-block" for="af-sign-in">{{ t('settings.directory.allowSignIn') }}</label>
            <div class="form-check form-switch mb-0">
              <input
                id="af-sign-in"
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="!user.blocked"
                :disabled="isAdminUser && !user.blocked"
                @change="onSignInSwitch"
              />
            </div>
            <!-- On, then Off on its own line -->
            <div class="form-text af-help-lines">
              {{ user.blocked ? t('settings.directory.blockedNote') : t('settings.users.signInHelp') }}
            </div>
          </div>
        </div>
        <!-- Groups : the group it belongs to, as the app's other tables -->
        <!-- Roles : the roles the user has, and how ; a row opens the role -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'roles'"
          :columns="roleColumns"
          :rows="userRoles"
          rowKey="name"
          :to="(r) => `/settings/roles/${encodeURIComponent(r.name)}`"
          :exportName="`${user.username}-roles`"
          :empty="t('settings.users.noRole')"
        >
          <!-- the roles ticked that name it : taken out of them -->
          <template #bulk-actions="{ selected, count }">
            <BsButton
              v-if="count"
              icon="trash"
              :disabled="rolesReadOnly || !selected.some((r) => r.direct)"
              @click="removeRoles(selected)"
              >{{ t('settings.settingsPage.removeFromRole') }} ({{ count }})</BsButton
            >
          </template>
        </AppLinkedTable>
        <!-- Forms : the forms its roles open ; a row opens the form -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'forms'"
          :exportName="`${user.username}-forms`"
          :columns="formColumns"
          :rows="userForms"
          rowKey="name"
          :to="(f) => formPath(f.name)"
          :empty="t('settings.linked.noFormUser')"
        />
        <!-- Jobs : the jobs it launched, the latest first ; a row opens the job -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'jobs'"
          :exportName="`${user.username}-jobs`"
          :columns="jobColumns"
          :children="stepsOf"
          childrenBefore="form"
          :rows="userJobs"
          :to="(j) => `/jobs/${j.id}`"
          :empty="t('settings.linked.noJob')"
        >
          <template #cell-status="{ row }"><AppStatusPill :status="row.status" /></template>
        </AppLinkedTable>
        <!-- Stored jobs : the form values it stored ; a row opens the stored job -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'stored-jobs'"
          :exportName="`${user.username}-stored-jobs`"
          :columns="storedJobColumns"
          :rows="userStoredJobs"
          :to="(j) => `/jobs/stored/${j.id}`"
          :empty="t('settings.users.noStoredJob')"
        />
        <!-- Schedules : the jobs it planned with Run later ; a row opens the schedule -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'schedules'"
          :exportName="`${user.username}-schedules`"
          :columns="scheduleColumns"
          :rows="userSchedules"
          :to="(s) => `/jobs/scheduled/${s.id}`"
          :empty="t('settings.users.noSchedule')"
        />
        <!-- Activity : what the audit log recorded it doing, the latest first -->
        <AppLinkedTable
          v-else-if="user && activeTab === 'activity'"
          :exportName="`${user.username}-activity`"
          :columns="activityColumns"
          :rows="activity"
          :empty="t('settings.linked.noActivity')"
        />
        <AppApiTokens
          v-else-if="user && activeTab === 'tokens'"
          @count="(n) => (tokenCount = n)"
          :url="`/api/v2/user/${encodeURIComponent(userId)}/tokens`"
          :toolbarTo="'#' + toolsId"
          :pagerTo="'#' + pagerId"
        />
        <!-- Groups : the groups it is in, a table as every list ; ticked, removed (a user keeps one) ;
             a row opens the group -->
        <BsDataTable
          v-else-if="user"
          framed
          :toolbarTo="'#' + toolsId"
          :pagerTo="'#' + pagerId"
          :items="userGroups"
          :columns="groupColumns"
          idKey="id"
          :rowClickSelects="false"
          linkColumn="name"
          :selectedIds="selectedGroups"
          name="user-groups"
          :exportName="`${user.username}-groups`"
          :empty="t('settings.users.noGroup')"
          @update:selectedIds="selectedGroups = $event"
          @row-click="(g) => router.push(`/settings/groups/${g.id}`)"
        >
          <template #bulk-actions="{ count }">
            <BsButton
              v-if="count"
              icon="trash"
              :disabled="count >= userGroups.length"
              :title="count >= userGroups.length ? t('settings.users.keepOneGroup') : null"
              @click="removeGroups([...selectedGroups])"
              >{{ t('settings.users.removeFromUser') }} ({{ count }})</BsButton
            >
          </template>
          <template #row-actions="{ item }">
            <div class="dropdown">
              <a
                role="button"
                class="bs-dt-row-menu px-2"
                data-bs-toggle="dropdown"
                data-bs-popper-config='{"strategy":"fixed"}'
              >
                <FaIcon icon="ellipsis-vertical" />
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <!-- its last group : a user keeps one -->
                  <a
                    class="dropdown-item"
                    :class="userGroups.length > 1 ? 'text-danger' : 'disabled text-muted'"
                    href="#"
                    @click.prevent="removeGroups([item.id])"
                  >
                    <FaIcon icon="trash" class="me-2" />{{ t('settings.users.removeFromUser') }}
                  </a>
                </li>
              </ul>
            </div>
          </template>
        </BsDataTable>
      </template>
      <!-- the Groups and API tokens tables' search, Select all, columns and export, on the title line
           (the other tabs' tables put theirs there themselves, AppLinkedTable) -->
      <template v-if="user && ['groups', 'tokens'].includes(activeTab)" #headerActions>
        <div :id="toolsId" class="af-title-flow"></div>
      </template>
      <!-- its pager, under the card -->
      <template #footer>
        <div :id="pagerId"></div>
      </template>
      <template v-if="user" #actions>
        <BsButton v-if="activeTab === 'roles'" icon="plus" :disabled="rolesReadOnly" @click="addingRole = true">{{
          t('settings.settingsPage.addRole')
        }}</BsButton>
        <BsButton
          v-if="activeTab === 'groups'"
          icon="plus"
          :disabled="!freeGroups.length"
          @click="addingGroup = freeGroups[0]?.id ?? null"
          >{{ t('settings.settingsPage.addGroup') }}</BsButton
        >
        <BsButton icon="lock" @click="changingPassword = true">{{ t('settings.common.changePassword') }}</BsButton>
        <BsButton icon="trash" :disabled="isAdminUser" @click="confirmDelete = true">{{ t('common.delete') }}</BsButton>
        <BsButton v-if="activeTab === 'details'" icon="save" :disabled="!dirty" @click="saveDetails()">{{
          t('settings.common.save')
        }}</BsButton>
      </template>
      <!-- the record loading : its buttons as grey placeholders, so the title line keeps its
           height and nothing moves when they come -->
      <template v-else-if="!loaded" #actions>
        <AppSkeleton shape="buttons" :widths="recordButtons('users', userId)" />
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the wide fields' width of the settings pages, as a role's name and description */
.af-user-field :deep(.input-group) {
  max-width: 40rem;
}
/* the details end a little above the card's edge : the card zeroes its last field's margin */
.af-user-details {
  padding-bottom: 0.5rem;
}
/* the count of a tab : small and grey, as the menus' badges */
.af-tab-count {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  font-weight: 600;
}
/* a help of several lines (Allow sign-in's On, then Off) : its line breaks kept */
.af-help-lines {
  white-space: pre-line;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
