<script setup>
/******************************************************************/
/*                                                                */
/*  Profile page                                                  */
/*  The signed-in user's account, preferences (language, theme),  */
/*  password and permissions : one view each, picked in the left  */
/*  menu, in the same page layout as the settings pages           */
/*                                                                */
/*  @query:                                                       */
/*      view: account | preferences | password | permissions |    */
/*            token (only for roles with extendedTokenExpiration) */
/*                                                                */
/******************************************************************/

import { ref, computed, watch, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import Theme from '@/lib/Theme';
import Helpers from '@/lib/Helpers';
import TokenStorage from '@/lib/TokenStorage';
import Profile from '@/lib/Profile';
import { languages, fallbackLanguage } from '@/config/languages';
import dayjs from 'dayjs';
import Time, { DATE_FORMATS } from '@/lib/Time';
import { profileViews, profileMenuViews } from '@/config/profileViews';
import BaseUrl from '@/lib/BaseUrl';
import { rememberSsoOrigin, ssoSettled } from '@/lib/ssoReturn';

// INIT

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

// the same swatches as the header's theme switcher
const palette = [
  '#008cba',
  '#0369a1',
  '#1b2a4a',
  '#521ea6',
  '#4a2a8f',
  '#bb1c5e',
  '#b92d34',
  '#c2570c',
  '#198754',
  '#0f766e',
  '#475569',
  '#795548',
];

// the views of the left menu (config/profileViews.js) ; the menu lists them alphabetically, see
// menuViews. The api token's view follows the role options of the store's profile
const VIEWS = profileViews(t, () => store.profile?.options);
// the menu : the views the user may open, alphabetically by their (translated) label, as in
// the designer's menu ; the page opens on the first of them
const menuViews = computed(() => profileMenuViews(VIEWS, locale.value));

// DATA

const themeColor = ref(Theme.getColor());
// the forms page's view : the same cookie the forms page keeps it in, so either place changes it
const formsView = ref(Helpers.getCookie('forms_view_mode') === 'list' ? 'list' : 'tiles');
const password = ref({ currentPassword: '', password: '', password2: '' });
const saving = ref(false);

// the open view, from the address (/profile/<view>) so a view can be linked to ; /profile alone,
// or a view the user may not open, opens the first of the menu, at its own address
const viewFromPath = (v) => (menuViews.value.some((x) => x.name === v) ? v : menuViews.value[0].name);
const currentView = ref(viewFromPath(route.params.view));
watch(
  () => route.params.view,
  (pathView) => {
    currentView.value = viewFromPath(pathView);
    if (pathView !== currentView.value) router.replace(`/profile/${currentView.value}`).catch(() => {});
  },
  { immediate: true },
);

// COMPUTED

const profile = computed(() => store.profile || {});
// the groups read (Profile.load) : the token carries none
const groupsKnown = computed(() => Array.isArray(profile.value.groups));
// the roles to show : every user also carries public, default's name before 7, so that forms still
// listing it match - it is the same role, shown once as default
const shownRoles = computed(() => (profile.value.roles || []).filter((r) => r !== 'public'));
// only local accounts have a password AnsibleForms can change ; ldap, azure ad and oidc
// passwords are managed by their own provider
const isLocal = computed(() => profile.value.type == 'local');
// the options grouped by what they are about ; an option the server sends that is not in
// a group (a hand-written key) lands in "other", under its own name
const PERMISSION_GROUPS = [
  {
    name: 'pages',
    title: () => t('profilePage.groupPages'),
    keys: [
      'showSettings',
      'showDesigner',
      'allowPlaybookDesign',
      'allowWorkflowDesign',
      'allowInventoryDesign',
      'allowVarsFileDesign',
      'showLogs',
      'showJobs',
      'showDebugButtons',
    ],
  },
  {
    name: 'jobs',
    title: () => t('profilePage.groupJobs'),
    keys: [
      'allowJobRelaunch',
      'allowVerboseMode',
      'allowScheduledJobs',
      'allowStoredJobs',
      'allowPlannedJobs',
      'showAllJobLogs',
      'showArtifacts',
      'showExtravars',
    ],
  },
  {
    name: 'other',
    title: () => t('profilePage.groupOther'),
    keys: ['allowLogin', 'allowBackupOps', 'allowChat', 'allowMcp', 'extendedTokenExpiration'],
  },
];
// what each option lets the user do (spelled out per key, so the i18n key check finds them)
const OPTION_DESCRIPTIONS = {
  showSettings: () => t('profilePage.optionDescription.showSettings'),
  showDesigner: () => t('profilePage.optionDescription.showDesigner'),
  allowPlaybookDesign: () => t('profilePage.optionDescription.allowPlaybookDesign'),
  allowWorkflowDesign: () => t('profilePage.optionDescription.allowWorkflowDesign'),
  allowInventoryDesign: () => t('profilePage.optionDescription.allowInventoryDesign'),
  allowVarsFileDesign: () => t('profilePage.optionDescription.allowVarsFileDesign'),
  showLogs: () => t('profilePage.optionDescription.showLogs'),
  showJobs: () => t('profilePage.optionDescription.showJobs'),
  showDebugButtons: () => t('profilePage.optionDescription.showDebugButtons'),
  allowJobRelaunch: () => t('profilePage.optionDescription.allowJobRelaunch'),
  allowVerboseMode: () => t('profilePage.optionDescription.allowVerboseMode'),
  allowScheduledJobs: () => t('profilePage.optionDescription.allowScheduledJobs'),
  allowStoredJobs: () => t('profilePage.optionDescription.allowStoredJobs'),
  allowPlannedJobs: () => t('profilePage.optionDescription.allowPlannedJobs'),
  showAllJobLogs: () => t('profilePage.optionDescription.showAllJobLogs'),
  showArtifacts: () => t('profilePage.optionDescription.showArtifacts'),
  showExtravars: () => t('profilePage.optionDescription.showExtravars'),
  allowLogin: () => t('profilePage.optionDescription.allowLogin'),
  allowBackupOps: () => t('profilePage.optionDescription.allowBackupOps'),
  allowChat: () => t('profilePage.optionDescription.allowChat'),
  allowMcp: () => t('profilePage.optionDescription.allowMcp'),
  extendedTokenExpiration: () => t('profilePage.optionDescription.extendedTokenExpiration'),
};
const permissionGroups = computed(() => {
  const opts = profile.value.options || {};
  // showExtraVars (capital V) is the server's legacy spelling of showExtravars, listed under
  // jobs : not shown twice
  const grouped = new Set([...PERMISSION_GROUPS.flatMap((g) => g.keys), 'showExtraVars']);
  return PERMISSION_GROUPS.map((g) => {
    const keys = g.keys.filter((k) => k in opts);
    if (g.name === 'other') keys.push(...Object.keys(opts).filter((k) => !grouped.has(k)));
    const options = keys.map((k) => ({ key: k, description: OPTION_DESCRIPTIONS[k]?.() || '', value: !!opts[k] }));
    return { name: g.name, title: g.title(), options, allowed: options.filter((o) => o.value).length };
  }).filter((g) => g.options.length);
});
const currentLanguage = computed(() => languages.find((l) => l.code === locale.value) || fallbackLanguage);

const view = computed(() => VIEWS.find((v) => v.name === currentView.value));
// how the account signs in : a readable name and an icon per login type
const loginType = computed(() => Profile.loginType(t, profile.value.type));

const pageDescription = computed(() =>
  currentView.value === 'password' && !isLocal.value
    ? t('profilePage.description.passwordElsewhere')
    : view.value.description(),
);

const sidebarSections = computed(() => [
  {
    title: '',
    items: menuViews.value.map((v) => ({
      title: v.label(),
      icon: v.icon,
      active: currentView.value === v.name,
      action: () => openView(v.name),
    })),
  },
]);

const passwordError = computed(() => {
  const p = password.value;
  if (p.password2 && p.password !== p.password2) return t('profilePage.mismatch');
  return '';
});
const canSavePassword = computed(() => {
  const p = password.value;
  return p.currentPassword && p.password && p.password === p.password2 && !saving.value;
});

// the api token : a login with the user's password and a longer expiry (the login endpoint's
// expiryDays, honoured for roles with extendedTokenExpiration) ; an SSO account has no password
// here, its token is made from this session (#1068), which must have signed in a few minutes ago :
// else the sign-in runs again first, and the token is made on the way back. Shown once ; it ends
// at its expiry, when it is revoked (the list under it), or with a password change or a block.
// The server caps the expiry at API_TOKEN_MAX_DAYS : only the lifetimes up to that cap are offered,
// plus the cap itself, so a longer choice is never silently shortened.
const tokenMaxDays = ref(90);
const TOKEN_LIFETIMES = computed(() => {
  const max = tokenMaxDays.value;
  const list = [30, 90, 180, 365].filter((d) => d <= max);
  if (!list.includes(max)) list.push(max);
  return list;
});
const tokenForm = ref({ days: 90, password: '', name: '' });
axios
  .get('/api/v2/auth/settings')
  .then((result) => {
    const max = parseInt(result.data?.apiTokenMaxDays, 10);
    if (!max) return;
    tokenMaxDays.value = max;
    if (tokenForm.value.days > max) tokenForm.value.days = Math.min(90, max);
  })
  .catch(() => {});
const tokenResult = ref(null);
const creatingToken = ref(false);
// the accounts that sign in with a password here confirm it ; an SSO account signs in again instead
const usesPassword = computed(() => ['local', 'ldap'].includes(profile.value.type));
const canSubmitToken = computed(() => !creatingToken.value && (!usesPassword.value || !!tokenForm.value.password));
// the list under the form, read again once a token is made
const tokensReload = ref(0);
// the token asked for before the sign-in ran again, made on the way back
const PENDING_TOKEN = 'af_pending_token';
const tokenExample = computed(() => `curl -H "Authorization: Bearer $TOKEN" ${window.location.origin}/api/v2/job`);

function showToken(token) {
  const exp = TokenStorage.decode(token).exp;
  tokenResult.value = { token, expires: Time.format(exp * 1000) };
  tokenForm.value.name = '';
  tokensReload.value++;
}

async function createToken() {
  if (!canSubmitToken.value) return;
  if (!usesPassword.value) return createTokenFromSession();
  creatingToken.value = true;
  try {
    const query = new URLSearchParams({ expiryDays: tokenForm.value.days });
    if (tokenForm.value.name.trim()) query.set('name', tokenForm.value.name.trim());
    const result = await axios.post(
      `/api/v2/auth/login?${query}`,
      {},
      { auth: { username: profile.value.username, password: tokenForm.value.password } },
    );
    const token = result.data?.token;
    if (!token) throw new Error('no token');
    showToken(token);
  } catch {
    toast.error(t('profilePage.token.failed'));
  } finally {
    tokenForm.value.password = '';
    creatingToken.value = false;
  }
}

/**
 * Makes the token from this session ; a sign-in too long ago runs the sign-in again first.
 *
 * Args:
 *   retry (boolean): false on the way back from that sign-in : asked again, it fails instead.
 */
async function createTokenFromSession(retry = true) {
  creatingToken.value = true;
  try {
    const result = await axios.post('/api/v2/profile/tokens', {
      expiryDays: tokenForm.value.days,
      name: tokenForm.value.name.trim(),
    });
    if (!result.data?.token) throw new Error('no token');
    showToken(result.data.token);
  } catch (err) {
    if (retry && err?.response?.status === 403 && err.response.data?.code === 'sign_in_again') {
      signInAgain();
      return;
    }
    toast.error(Helpers.parseAxiosResponseError(err, t('profilePage.token.failedSession')));
  } finally {
    creatingToken.value = false;
  }
}

// through the provider again, back to this page, where the token asked for is made
function signInAgain() {
  try {
    sessionStorage.setItem(PENDING_TOKEN, JSON.stringify({ days: tokenForm.value.days, name: tokenForm.value.name }));
  } catch {
    // no storage : the user asks again once back
  }
  toast.info(t('profilePage.token.signingInAgain'));
  rememberSsoOrigin('/profile/token');
  const issuer = profile.value.type === 'oidc' ? 'oidc' : 'azuread';
  localStorage.setItem('authIssuer', issuer);
  window.location.replace(`${BaseUrl}/api/v2/auth/${issuer === 'oidc' ? 'oidc' : 'azureadoauth2'}`);
}

// back from that sign-in : the token asked for before it
async function resumePendingToken() {
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_TOKEN) || 'null');
    sessionStorage.removeItem(PENDING_TOKEN);
  } catch {
    pending = null;
  }
  if (!pending) return;
  await ssoSettled();
  if (Number(pending.days)) tokenForm.value.days = Number(pending.days);
  tokenForm.value.name = String(pending.name || '');
  await createTokenFromSession(false);
}
resumePendingToken();

async function copyToken() {
  try {
    await navigator.clipboard.writeText(tokenResult.value.token);
    toast.success(t('profilePage.token.copied'));
  } catch {
    // no clipboard access (plain http) : the token stays selectable in its box
  }
}

// METHODS

function openView(name) {
  router.replace(`/profile/${name}`).catch(() => {});
}

function setLanguage(code) {
  locale.value = code;
  Helpers.setCookie('af_language', code);
}

function setTheme(theme) {
  if (theme === 'color') {
    Theme.choose('color');
    Theme.applyColor(themeColor.value);
  } else {
    Theme.clearColor();
    Theme.choose(theme);
  }
}

// the time zone the whole app shows dates in (lib/Time.js) : UTC, this browser's zone, or any
const timezone = computed({
  get: () => store.timezone || 'UTC',
  set: (value) => Time.setPreference(value),
});
// the date format dates show in : the app's default until the user picks one (lib/Time.js)
const dateFormat = computed({
  get: () => Time.datePattern(),
  set: (value) => Time.setDateFormat(value),
});
const dateFormats = DATE_FORMATS;
const browserZone = Time.browserZone();
const allZones = Time.zones().filter((z) => z !== 'UTC');
// the time now as AnsibleForms shows it in the picked zone, under the picker : it ticks
// along while the page is open, and follows the picker at once
const now = ref(new Date());
const nowTimer = setInterval(() => (now.value = new Date()), 30000);
onBeforeUnmount(() => clearInterval(nowTimer));
const timezoneNow = computed(() => Time.format(now.value, 'YYYY-MM-DD HH:mm'));
// the zone's offset from UTC now (summer time included), as UTC+02:00 ; UTC itself needs none
const timezoneOffset = computed(() => {
  const zone = Time.zone();
  if (zone === 'UTC') return '';
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(now.value)
      .find((p) => p.type === 'timeZoneName')?.value;
    // 'GMT+02:00', or plain 'GMT' for a zone on UTC time
    return part ? part.replace('GMT', 'UTC').replace(/^UTC$/, 'UTC+00:00') : '';
  } catch {
    return '';
  }
});

function setFormsView(mode) {
  formsView.value = mode;
  Helpers.setCookie('forms_view_mode', mode, 365);
}

function pickColor(hex) {
  themeColor.value = hex;
  setTheme('color');
}

async function changePassword() {
  if (!canSavePassword.value) return;
  saving.value = true;
  try {
    await axios.put(`/api/v2/profile`, password.value);
    // a new password ends every session of the user, this one too : sign in again with it
    toast.success(t('profilePage.changedSignIn'));
    password.value = { currentPassword: '', password: '', password2: '' };
    TokenStorage.clear();
    router.push({ name: '/login' });
  } catch (err) {
    // the server's reason (the password policy, a wrong current password) rather than the status
    toast.error(Helpers.parseAxiosResponseError(err, t('profilePage.changeFailed')));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap af-settings-layout">
      <BsSidebar :sections="sidebarSections" storageKey="af_profile_sidebar_collapsed" />
      <!-- account, preferences and permissions lay out cards of their own ; password and the api
           token sit in the page's card -->
      <AppSettings
        :title="view.label()"
        :icon="view.icon"
        :description="pageDescription"
        :bare="['account', 'preferences', 'permissions'].includes(currentView)"
      >
        <!-- ===================== account ===================== -->
        <template v-if="currentView === 'account'">
          <div class="card">
            <!-- who : the person's name when the sign-in brought one (ldap, azure ad, openid
                 connect), else the username - the username itself is a row below. Styled like
                 the permissions tables' headers, without a border-bottom of its own : the list
                 group under it draws that line (a list group in a card takes the card's border
                 on top), so both would double it -->
            <div class="card-body d-flex align-items-center af-identity py-3">
              <span class="fw-semibold text-truncate">{{ profile.displayName || profile.username }}</span>
            </div>
            <!-- the details : a label column and its values, one row each -->
            <ul class="list-group list-group-flush">
              <li class="list-group-item af-detail">
                <span class="af-detail-label">{{ t('profilePage.username') }}</span>
                <span class="af-detail-value">{{ profile.username }}</span>
              </li>
              <li class="list-group-item af-detail">
                <span class="af-detail-label">{{ t('profilePage.loginType') }}</span>
                <span class="af-detail-value"
                  ><FaIcon :icon="loginType.icon" :fixedwidth="true" class="me-2 text-body-secondary" />{{
                    loginType.label
                  }}</span
                >
              </li>
              <li class="list-group-item af-detail">
                <span class="af-detail-label"
                  >{{ t('profilePage.groups') }}
                  <span v-if="groupsKnown" class="af-count">{{ profile.groups.length }}</span></span
                >
                <!-- the groups are read from the server (the token does not carry them) : a grey bar
                     until then, rather than "none yet" -->
                <span v-if="!groupsKnown" class="af-detail-value"><AppSkeleton shape="inline" width="7rem" /></span>
                <span v-else class="af-detail-value">
                  <span v-for="g in profile.groups" :key="g" class="badge af-chip"
                    ><FaIcon icon="users" class="me-1" />{{ g }}</span
                  >
                  <span v-if="!profile.groups.length" class="text-body-secondary">{{ t('profilePage.noneYet') }}</span>
                </span>
              </li>
              <li class="list-group-item af-detail">
                <span class="af-detail-label"
                  >{{ t('profilePage.roles') }} <span class="af-count">{{ shownRoles.length }}</span></span
                >
                <span class="af-detail-value">
                  <span v-for="r in shownRoles" :key="r" class="badge af-chip"
                    ><FaIcon icon="user-shield" class="me-1" />{{ r }}</span
                  >
                  <span v-if="!shownRoles.length" class="text-body-secondary">{{ t('profilePage.noneYet') }}</span>
                </span>
              </li>
            </ul>
          </div>
        </template>

        <!-- ===================== preferences ===================== -->
        <template v-else-if="currentView === 'preferences'">
          <!-- every preference in one card, as Settings > Appearance > Defaults -->
          <div class="card">
            <div class="card-body">
              <label class="form-label fw-bold">{{ t('profilePage.language') }}</label>
              <div class="input-group af-field">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="language" /></span>
                <button
                  class="form-select d-flex align-items-center gap-2 text-start"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  :aria-label="t('profilePage.language')"
                >
                  <AppFlag :code="currentLanguage.code" />{{ currentLanguage.label }}
                </button>
                <ul class="dropdown-menu w-100">
                  <li v-for="lang in languages" :key="lang.code">
                    <button
                      type="button"
                      class="dropdown-item d-flex align-items-center gap-2"
                      :class="{ active: locale === lang.code }"
                      @click="setLanguage(lang.code)"
                    >
                      <AppFlag :code="lang.code" />{{ lang.label }}
                    </button>
                  </li>
                </ul>
              </div>
              <div class="form-text">{{ t('profilePage.languageHint') }}</div>
              <label class="form-label fw-bold mt-4">{{ t('profilePage.theme') }}</label>
              <div class="af-choice-grid af-field">
                <button
                  v-for="th in Theme.themes()"
                  :key="th.value"
                  type="button"
                  class="af-choice"
                  :class="{ active: store.theme === th.value }"
                  @click="setTheme(th.value)"
                >
                  <FaIcon :icon="th.icon" class="me-2" />{{ th.title }}
                </button>
              </div>
              <div v-if="store.theme === 'color'" class="af-palette mt-3">
                <button
                  v-for="c in palette"
                  :key="c"
                  type="button"
                  class="af-swatch"
                  :class="{ active: themeColor === c }"
                  :style="{ backgroundColor: c }"
                  :aria-label="c"
                  @click="pickColor(c)"
                >
                  <FaIcon v-if="themeColor === c" icon="check" />
                </button>
              </div>
              <div class="form-text">{{ t('profilePage.themeHint') }}</div>
              <label class="form-label fw-bold mt-4">{{ t('profilePage.formsView') }}</label>
              <div class="af-choice-grid af-field">
                <button
                  v-for="m in [
                    { value: 'tiles', icon: 'th', label: t('forms.tiles') },
                    { value: 'list', icon: 'th-list', label: t('forms.list') },
                  ]"
                  :key="m.value"
                  type="button"
                  class="af-choice"
                  :class="{ active: formsView === m.value }"
                  @click="setFormsView(m.value)"
                >
                  <FaIcon :icon="m.icon" class="me-2" />{{ m.label }}
                </button>
              </div>
              <div class="form-text">{{ t('profilePage.formsViewHint') }}</div>
              <label class="form-label fw-bold mt-4">{{ t('profilePage.timezone') }}</label>
              <div class="input-group af-field">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="clock" /></span>
                <select v-model="timezone" class="form-select" :aria-label="t('profilePage.timezone')">
                  <option value="UTC">UTC</option>
                  <option value="browser">{{ t('profilePage.timezoneBrowser', { zone: browserZone }) }}</option>
                  <optgroup :label="t('profilePage.timezoneAll')">
                    <option v-for="z in allZones" :key="z" :value="z">{{ z }}</option>
                  </optgroup>
                </select>
              </div>
              <div class="form-text">{{ t('profilePage.timezoneHint') }}</div>
              <!-- the date format : how the date part of every date reads -->
              <label class="form-label fw-bold mt-4">{{ t('profilePage.dateFormat') }}</label>
              <div class="input-group af-field">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="calendar" /></span>
                <select v-model="dateFormat" class="form-select" :aria-label="t('profilePage.dateFormat')">
                  <option v-for="f in dateFormats" :key="f" :value="f">{{ dayjs(now).format(f) }} ({{ f }})</option>
                </select>
              </div>
              <div class="form-text">{{ t('profilePage.dateFormatHint') }}</div>
              <!-- the time now in the picked zone and format : how dates read across the app -->
              <div class="af-tz-now mt-3">
                <span class="af-tz-now-icon"><FaIcon icon="clock" /></span>
                <span class="d-flex flex-column">
                  <span class="af-tz-now-time">{{ timezoneNow }}</span>
                  <small class="text-body-secondary"
                    >{{ Time.zone() }}<template v-if="timezoneOffset"> · {{ timezoneOffset }}</template></small
                  >
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- ===================== password ===================== -->
        <template v-else-if="currentView === 'password'">
          <form
            v-if="isLocal"
            class="af-field"
            @submit.prevent="changePassword"
            @keydown.enter.prevent="changePassword"
          >
            <div class="mb-3">
              <label class="form-label fw-bold" for="af-current-password">{{ t('profilePage.currentPassword') }}</label>
              <div class="input-group">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="lock" /></span>
                <input
                  id="af-current-password"
                  v-model="password.currentPassword"
                  type="password"
                  class="form-control"
                  autocomplete="current-password"
                />
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold" for="af-new-password">{{ t('profilePage.newPassword') }}</label>
              <div class="input-group">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="key" /></span>
                <input
                  id="af-new-password"
                  v-model="password.password"
                  type="password"
                  class="form-control"
                  autocomplete="new-password"
                />
              </div>
            </div>
            <div>
              <label class="form-label fw-bold" for="af-confirm-password">{{ t('profilePage.confirmPassword') }}</label>
              <div class="input-group has-validation">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="check-double" /></span>
                <input
                  id="af-confirm-password"
                  v-model="password.password2"
                  type="password"
                  class="form-control"
                  :class="{ 'is-invalid': passwordError }"
                  autocomplete="new-password"
                />
                <div class="invalid-feedback">{{ passwordError }}</div>
              </div>
            </div>
          </form>
          <p v-else class="text-body-secondary mb-0">
            <FaIcon icon="circle-info" class="me-2" />{{ t('profilePage.elsewhere', { type: profile.type }) }}
          </p>
        </template>

        <!-- ===================== permissions ===================== -->
        <template v-else-if="currentView === 'permissions'">
          <!-- a card per group : its name and how many of its options are allowed, then a row
               per option with its readable name, its key, and whether it is allowed -->
          <div
            v-for="(group, gi) in permissionGroups"
            :key="group.name"
            class="card af-table-card"
            :class="{ 'mt-3': gi > 0 }"
          >
            <div class="card-body d-flex align-items-center justify-content-between af-identity py-3 border-bottom">
              <span class="fw-semibold">{{ group.title }}</span>
              <small class="text-body-secondary">{{
                t('profilePage.allowedCount', { n: group.allowed, total: group.options.length })
              }}</small>
            </div>
            <div class="table-responsive">
              <table v-fit-columns class="table mb-0 af-perm-table">
                <thead>
                  <tr>
                    <th>{{ t('profilePage.columnSetting') }}</th>
                    <th>{{ t('profilePage.columnDescription') }}</th>
                    <th class="text-end">{{ t('profilePage.columnAccess') }}</th>
                    <th class="af-fit-spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in group.options" :key="o.key">
                    <td>
                      <code class="af-option-key">{{ o.key }}</code>
                    </td>
                    <td :class="o.value ? '' : 'text-body-secondary'">{{ o.description }}</td>
                    <td class="text-end">
                      <span class="badge rounded-pill af-pill" :class="o.value ? 'af-pill-green' : 'af-pill-grey'">
                        <FaIcon :icon="o.value ? 'check' : 'xmark'" class="me-1" />{{
                          o.value ? t('profilePage.allowed') : t('profilePage.notAllowed')
                        }}
                      </span>
                    </td>
                    <td class="af-fit-spacer"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ===================== api token ===================== -->
        <template v-else-if="currentView === 'token'">
          <!-- the token, once : copy it now -->
          <div v-if="tokenResult">
            <label class="form-label fw-semibold" for="af-token">{{
              t('profilePage.token.created', { date: tokenResult.expires })
            }}</label>
            <div class="input-group mb-2">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="key" /></span>
              <input
                id="af-token"
                class="form-control font-monospace"
                :value="tokenResult.token"
                readonly
                @focus="$event.target.select()"
              />
              <button type="button" class="btn btn-outline-primary" @click="copyToken">
                <FaIcon icon="copy" class="me-1" />{{ t('profilePage.token.copy') }}
              </button>
            </div>
            <div class="alert alert-warning d-flex align-items-start gap-2 py-2 mb-4">
              <FaIcon icon="triangle-exclamation" class="mt-1" /><span>{{ t('profilePage.token.once') }}</span>
            </div>
            <p class="mb-2 text-body-secondary">{{ t('profilePage.token.example') }}</p>
            <pre class="af-token-example mb-4"><code>{{ tokenExample }}</code></pre>
            <button type="button" class="btn btn-outline-primary" @click="tokenResult = null">
              <FaIcon icon="plus" class="me-2" />{{ t('profilePage.token.another') }}
            </button>
          </div>
          <!-- the request : a lifetime and the password -->
          <form v-else class="af-field" @submit.prevent="createToken" @keydown.enter.prevent="createToken">
            <div class="mb-3">
              <label class="form-label fw-bold" for="af-token-days">{{ t('profilePage.token.lifetime') }}</label>
              <div class="input-group">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="hourglass-half" /></span>
                <select id="af-token-days" v-model.number="tokenForm.days" class="form-select">
                  <option v-for="d in TOKEN_LIFETIMES" :key="d" :value="d">
                    {{ t('profilePage.token.days', { n: d }) }}
                  </option>
                </select>
              </div>
              <div class="form-text">{{ t('profilePage.token.lifetimeHint') }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label fw-bold" for="af-token-name">{{ t('profilePage.token.name') }}</label>
              <div class="input-group">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="tag" /></span>
                <input id="af-token-name" v-model="tokenForm.name" type="text" maxlength="100" class="form-control" />
              </div>
              <div class="form-text">{{ t('profilePage.token.nameHint') }}</div>
            </div>
            <p v-if="!usesPassword" class="text-body-secondary mb-0">
              <FaIcon icon="circle-info" class="me-2" />{{
                t('profilePage.token.signInAgainHint', { type: loginType.label })
              }}
            </p>
            <div v-else>
              <label class="form-label fw-bold" for="af-token-password">{{ t('profilePage.token.password') }}</label>
              <div class="input-group">
                <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="lock" /></span>
                <input
                  id="af-token-password"
                  v-model="tokenForm.password"
                  type="password"
                  class="form-control"
                  autocomplete="current-password"
                />
              </div>
              <div class="form-text">{{ t('profilePage.token.passwordHint') }}</div>
            </div>
          </form>
          <!-- the tokens made, each to revoke -->
          <div class="mt-4 pt-3 border-top">
            <h6 class="fw-bold mb-2">{{ t('profilePage.token.yours') }}</h6>
            <AppApiTokens url="/api/v2/profile/tokens" :reload="tokensReload" />
          </div>
        </template>

        <!-- the view's action, where the settings pages put their Save button : below the card,
             on the right, grey until the form can be sent, then the accent color -->
        <template v-if="(currentView === 'password' && isLocal) || (currentView === 'token' && !tokenResult)" #actions>
          <BsButton
            v-if="currentView === 'password'"
            icon="key"
            :colorClass="canSavePassword ? 'primary' : 'secondary'"
            :disabled="!canSavePassword"
            @click="changePassword"
            >{{ t('profilePage.change') }}</BsButton
          >
          <BsButton
            v-else
            icon="code"
            :colorClass="canSubmitToken ? 'primary' : 'secondary'"
            :disabled="!canSubmitToken"
            @click="createToken"
            >{{ t('profilePage.token.create') }}</BsButton
          >
        </template>
      </AppSettings>
    </main>
  </div>
</template>

<style scoped lang="scss">
// the identity band at the top of the account card
.af-identity {
  padding: 1.25rem;
  background-color: var(--bs-tertiary-bg);
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}
// a detail row : the label in a fixed column, the value next to it
// every row as high as one with chips (3.5rem), whatever it holds ; more chips than fit
// wrap and make that row taller only then. The label and the first line of values share
// one line height (a chip's), and the row aligns them at its top : with many groups or
// roles, the label stays on the first line instead of drifting to the middle of the row.
$af-detail-line: 1.8rem;
.af-detail {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  min-height: 3.5rem;
  // the padding leaves room for the row's 1px bottom border, so a one-line row is 3.5rem
  padding: calc((3.5rem - #{$af-detail-line} - 1px) / 2) 1.25rem;
}
.af-detail-label {
  flex: 0 0 11rem;
  line-height: $af-detail-line;
  color: var(--bs-secondary-color);
  font-weight: 500;
}
.af-detail-value {
  flex: 1 1 auto;
  min-width: 0;
  min-height: $af-detail-line;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  // the chips are spaced by the gap here, not by their own margin
  .af-chip {
    margin: 0;
  }
}
.af-tz-now {
  display: inline-flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-tertiary-bg);
}
.af-tz-now-icon {
  font-size: 1.5rem;
  color: var(--af-primary);
}
.af-tz-now-time {
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.af-count {
  display: inline-block;
  // its own line height : the label's (a chip's) would make the count taller than the line
  line-height: 1.5;
  min-width: 1.4rem;
  margin-left: 0.35rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  font-size: 0.75rem;
  text-align: center;
  background-color: var(--bs-secondary-bg);
}
.af-chip {
  font-size: 0.85rem;
  font-weight: 500;
  margin: 0 0.35rem 0.35rem 0;
  padding: 0.45em 0.8em;
  color: var(--bs-body-color);
  background-color: var(--bs-secondary-bg);
  border: 1px solid var(--bs-border-color);
}

// one width for the fields of every view (password, api token, preferences) ; in a form only
// its fields have that width, so their help text below can use the whole card, as in the
// preferences cards
.af-field {
  max-width: 480px;
}
form.af-field {
  max-width: none;
  .input-group {
    max-width: 480px;
  }
}
// the theme choices : a row of selectable tiles
.af-choice-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 160px));
  gap: 0.5rem;
}
.af-choice {
  display: flex;
  align-items: center;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--bs-body-color);
  text-align: left;
  transition:
    border-color 0.15s,
    background-color 0.15s;
  &:hover {
    border-color: var(--af-primary);
  }
  &.active {
    border-color: var(--af-primary);
    box-shadow: inset 0 0 0 1px var(--af-primary);
    background-color: var(--af-primary-bg-subtle);
    font-weight: 600;
  }
}
.af-palette {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0.4rem;
  max-width: 420px;
}
.af-swatch {
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.7rem;
  &.active {
    border-color: var(--bs-body-color);
  }
}

// a card holding a table : the table is clipped to the card's rounded corners, which its
// own background would otherwise cover (the side borders then stopped short of the bottom)
.af-table-card {
  overflow: hidden;
}
// permissions : a table per group ; the setting and the access in fixed columns, the
// description takes the rest
.af-perm-table {
  th,
  td {
    padding: 0.7rem 1.25rem;
    vertical-align: middle;
  }
  th {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bs-secondary-color);
    white-space: nowrap;
  }
  // the same fixed column widths in every card, so the columns line up from card to card ;
  // the description takes what is left
  table-layout: fixed;
  th:nth-child(1) {
    width: 13rem; // the longest key, extendedTokenExpiration, fits
  }
  th:nth-child(3) {
    width: 9.5rem;
  }
  td {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  td:not(:nth-child(2)) {
    white-space: nowrap;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
}
// permissions : the option key under its readable name, and the allowed / not allowed pill
.af-option-key {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
}
.af-pill {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.4em 0.75em;
}
// the curl example under a new token
.af-token-example {
  padding: 0.75rem 1rem;
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
