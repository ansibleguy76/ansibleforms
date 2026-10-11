<script setup>
/******************************************************************/
/*                                                                */
/*  An LDAP or SSO group's page (/settings/groups/<source>/<name>)*/
/*  opened from the groups list : a group seen at a sign-in or    */
/*  named by a role, read only - its directory owns it - in tabs, */
/*  the tab kept in the address ; a row of a tab opens its item : */
/*  Users - the users seen in it at their last sign-in            */
/*  Roles - the roles that name it                                */
/*  Forms - the forms those roles open                            */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import { formPath } from '@/lib/formsPath';
import { sourceLabel } from '@/config/settings';
import { useRouteTab } from '@/composables/useRouteTab';
import { useRoleAssignments } from '@/composables/useRoleAssignments';
import { useFormLinks } from '@/composables/useFormLinks';

const { t } = useI18n();
const route = useRoute();
const authenticated = ref(false);
const loaded = ref(false);

// ─── the group ────────────────────────────────────────────────────────────────
const source = computed(() => String(route.params.type || ''));
const groupName = computed(() => String(route.params.name || ''));
const group = ref(null); // { id, source, name, members, user_count, role_count }
const sourceName = computed(() => sourceLabel(t, source.value));

/**
 * Loads the group ; none when it was neither seen at a sign-in nor named by a role.
 */
async function load() {
  try {
    const res = await axios.get(
      `/api/v2/directory/groups/${encodeURIComponent(source.value)}/${encodeURIComponent(groupName.value)}`,
    );
    group.value = res.data.records ? res.data.records[0] : res.data;
  } catch {
    group.value = null;
  }
  loaded.value = true;
}

// its users seen at their last sign-in ; a row opens the user's page
const members = computed(() => (group.value?.members || []).map((username) => ({ username })));
const memberColumns = computed(() => [{ key: 'username', label: t('settings.fields.username') }]);

// ─── Roles, Forms ─────────────────────────────────────────────────────────────
// the roles that name the group ; a row opens the role
const { loadRoles, rolesOfGroup } = useRoleAssignments();
const groupRoles = computed(() => (group.value ? rolesOfGroup(group.value.name, source.value) : []));
const roleColumns = computed(() => [
  { key: 'name', label: t('settings.common.role') },
  { key: 'description', label: t('settings.fields.description') },
]);
// the forms those roles open, and through which ; a row opens the form
const { loadForms, formsOfRoles } = useFormLinks();
const groupForms = computed(() => formsOfRoles(groupRoles.value.map((r) => r.name)));
const formColumns = computed(() => [
  { key: 'name', label: t('settings.fields.form') },
  { key: 'through', label: t('settings.linked.throughRoles'), value: (f) => f.through.join(', ') },
  { key: 'description', label: t('settings.fields.description') },
]);

// ─── tabs ─────────────────────────────────────────────────────────────────────
const tabs = computed(() => [
  { key: 'users', label: t('settings.settingsPage.users'), icon: 'user', count: members.value.length },
  { key: 'roles', label: t('settings.settingsPage.roles'), icon: 'user-shield', count: groupRoles.value.length },
  { key: 'forms', label: t('settings.linked.forms'), icon: 'rectangle-list', count: groupForms.value.length },
]);
const { activeTab, tabLink } = useRouteTab('users', (key) => tabs.value.some((x) => x.key === key));

// the title : Groups › <name>, each step a link, and the open tab last
const crumbs = computed(() => {
  const base = [
    { title: t('sidebar.groups'), icon: 'users', to: '/settings/groups' },
    {
      title: groupName.value,
      icon: 'users',
      to: `/settings/groups/${encodeURIComponent(source.value)}/${encodeURIComponent(groupName.value)}`,
    },
  ];
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...base, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : base;
});

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await Promise.all([load(), loadRoles(), loadForms()]);
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="users"
      :title="groupName"
      :crumbs="crumbs"
      :description="t('settings.groups.description')"
    >
      <template v-if="group" #tabs>
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
              <span class="badge af-tab-count ms-1">{{ tab.count }}</span>
            </a>
          </li>
        </ul>
      </template>
      <template #default>
        <div v-if="loaded && !group" class="empty-state">
          <FaIcon icon="users" class="empty-state-icon" />
          <span>{{ t('settings.directory.groupNotFound', { name: groupName, source: sourceName }) }}</span>
        </div>
        <template v-else-if="group">
          <!-- where it comes from : its users are those seen in it -->
          <div class="alert alert-secondary py-2 af-directory-note">
            <FaIcon icon="circle-info" class="me-2" />{{
              t('settings.directory.groupReadOnlyNote', { source: sourceName })
            }}
          </div>
          <AppLinkedTable
            v-if="activeTab === 'users'"
            :columns="memberColumns"
            :rows="members"
            rowKey="username"
            :to="(m) => `/settings/users/${encodeURIComponent(source)}/${encodeURIComponent(m.username)}`"
            :empty="t('settings.directory.noMember')"
          />
          <AppLinkedTable
            v-else-if="activeTab === 'roles'"
            :columns="roleColumns"
            :rows="groupRoles"
            rowKey="name"
            :to="(r) => `/settings/roles/${encodeURIComponent(r.name)}`"
            :empty="t('settings.groups.noRole')"
          />
          <AppLinkedTable
            v-else
            :columns="formColumns"
            :rows="groupForms"
            rowKey="name"
            :to="(f) => formPath(f.name)"
            :empty="t('settings.linked.noFormGroup')"
          />
        </template>
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
.af-directory-note {
  max-width: 40rem;
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
