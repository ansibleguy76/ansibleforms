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
/*            token (only for roles with allowApiTokens or        */
/*            extendedTokenExpiration)                            */
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
import { roleOptionGroups, roleOptionDescription, roleOptionLabel, effectiveRoleOption } from '@/config/roles';
import BaseUrl from '@/lib/BaseUrl';
import { neverExpires } from '@/lib/apiTokens';
import { rememberSsoOrigin, ssoSettled, ssoReturning } from '@/lib/ssoReturn';
import { hasPermission } from '@/lib/permission';
import { useRouteTab } from '@/composables/useRouteTab';
import {
  notificationsSupported,
  notificationPermission,
  notificationsActive,
  turnNotificationsOn,
  turnNotificationsOff,
} from '@/lib/jobNotifications';

// INIT

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const { t, te, locale } = useI18n();

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
// only local accounts have a password AnsibleForms can change ; ldap, Entra ID and oidc
// passwords are managed by their own provider
const isLocal = computed(() => profile.value.type == 'local');
// the options in their groups, as the role's page shows them (config/roles.js) ; an option the
// server sends that is in no group (a hand-written key) lands in "other", under its own name
const PERMISSION_GROUPS = [
  ...roleOptionGroups.map((g) => ({ name: g.name, title: () => t(g.title), keys: g.keys })),
  { name: 'other', title: () => t('profilePage.groupOther'), keys: [] },
];
const permissionGroups = computed(() => {
  const opts = profile.value.options || {};
  // showExtraVars (capital V) is the server's legacy spelling of showExtravars, listed under
  // jobs : not shown twice
  const grouped = new Set([...PERMISSION_GROUPS.flatMap((g) => g.keys), 'showExtraVars']);
  return PERMISSION_GROUPS.map((g) => {
    const keys = g.keys.filter((k) => k in opts);
    if (g.name === 'other') keys.push(...Object.keys(opts).filter((k) => !grouped.has(k)));
    // what applies (config/roles.js effectiveRoleOption) : an option included in another that is on
    // is allowed, one missing the option it needs is not - and the row says why
    const options = keys.map((k) => {
      const eff = effectiveRoleOption(opts, k);
      const note = eff.includedBy
        ? t('settings.settingsPage.roleOptionIncluded', { option: roleOptionLabel(t, eff.includedBy) })
        : eff.needs
          ? t('settings.settingsPage.roleOptionNeeds', { option: roleOptionLabel(t, eff.needs) })
          : '';
      return { key: k, description: roleOptionDescription(t, te, k), value: eff.value, note };
    });
    return { name: g.name, title: g.title(), options, allowed: options.filter((o) => o.value).length };
  }).filter((g) => g.options.length);
});
const currentLanguage = computed(() => languages.find((l) => l.code === locale.value) || fallbackLanguage);

const view = computed(() => VIEWS.find((v) => v.name === currentView.value));
// desktop notifications are offered only to a user who sees its jobs
const mayNotify = computed(() => hasPermission(store.profile?.options, 'showJobs'));
// Preferences in tabs, kept in the address (/profile/preferences/<tab>) : how the app looks (its
// language, theme and forms view), dates and times, and the notifications for a user who sees its jobs
const prefTabs = computed(() => [
  { key: 'appearance', label: t('profilePage.tabAppearance'), icon: 'palette' },
  { key: 'datetime', label: t('profilePage.tabDateTime'), icon: 'clock' },
  ...(mayNotify.value ? [{ key: 'notifications', label: t('profilePage.tabNotifications'), icon: 'bell' }] : []),
]);
// the open view's tabs : Preferences' ; Password one tab of its own (every settings page a table or
// a page in tabs) ; the others none (cards of their own, or the API token's table)
const viewTabs = computed(() => {
  if (currentView.value === 'preferences') return prefTabs.value;
  if (currentView.value === 'password') return [{ key: 'change', label: t('nav.changePassword'), icon: 'key' }];
  return [];
});
const { activeTab: prefTab, tabLink: prefTabLink } = useRouteTab(
  () => viewTabs.value[0]?.key || 'appearance',
  (key) => viewTabs.value.some((x) => x.key === key),
);
// the title's steps on a view in tabs : the view, then its tab
const crumbs = computed(() => {
  if (!viewTabs.value.length) return undefined;
  const tab = viewTabs.value.find((x) => x.key === prefTab.value) || viewTabs.value[0];
  return [
    { title: view.value.label(), icon: view.value.icon, to: prefTabLink(viewTabs.value[0].key) },
    { title: tab.label, icon: tab.icon, to: prefTabLink(tab.key) },
  ];
});
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
// expiryDays, honoured for roles with allowApiTokens or extendedTokenExpiration) ; an SSO account has no password
// here, its token is made from this session (#1068), which must have signed in a few minutes ago :
// else the sign-in runs again first, and the token is made on the way back. Shown once ; it ends
// at its expiry, when it is revoked (the list under it), or with a password change or a block.
// The server caps the expiry at API_TOKEN_MAX_DAYS : only the lifetimes up to that cap are offered,
// plus the cap itself, so a longer choice is never silently shortened.
const tokenMaxDays = ref(90);
// a role with extendedTokenExpiration may also make one that never expires ('never')
const canNeverExpire = computed(
  () => !!profile.value?.options?.allowApiTokens && !!profile.value?.options?.extendedTokenExpiration,
);
const TOKEN_LIFETIMES = computed(() => {
  const max = tokenMaxDays.value;
  const list = [30, 90, 180, 365].filter((d) => d <= max);
  if (!list.includes(max)) list.push(max);
  if (canNeverExpire.value) list.push('never');
  return list;
});
// the lifetimes as the select shows them : 90 days ... , Never expires
const lifetimeOptions = computed(() =>
  TOKEN_LIFETIMES.value.map((d) => ({
    value: d,
    label: d === 'never' ? t('apiTokens.neverExpires') : t('profilePage.token.days', { n: d }),
  })),
);
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
// the token asked for before the sign-in ran again, made on the way back : only right after that
// sign-in, by the same user, a few minutes later at most (an abandoned one is never made later)
const PENDING_TOKEN = 'af_pending_token';
const PENDING_MAX_MS = 5 * 60 * 1000;
const tokenExample = computed(() => `curl -H "Authorization: Bearer $TOKEN" ${window.location.origin}/api/v2/job`);

// where the token list's toolbar goes (the title line)
const tokenToolsId = `af-token-tools-${Math.random().toString(36).slice(2, 10)}`;
const tokenPagerId = `af-token-pager-${Math.random().toString(36).slice(2, 10)}`;
// the New token wizard : its steps, the one shown, the furthest reached
const tokenDialog = ref(false);
const tokenStep = ref(0);
const tokenReached = ref(0);
const tokenSteps = computed(() => [
  { key: 'token', label: t('profilePage.token.stepToken') },
  { key: 'confirm', label: t('profilePage.token.stepConfirm') },
  { key: 'copy', label: t('profilePage.token.stepCopy') },
]);

/** Opens the wizard on its first step, the form empty. */
function openTokenWizard() {
  tokenResult.value = null;
  tokenForm.value.name = '';
  tokenForm.value.password = '';
  tokenStep.value = 0;
  tokenReached.value = 0;
  tokenDialog.value = true;
}

// a token is named : what it is for, so it is told apart in the list (and revoked as the right one)
const tokenNamed = computed(() => !!tokenForm.value.name.trim());

/** From the token (name, lifetime) to its confirmation ; only once it is named. */
function nextTokenStep() {
  if (!tokenNamed.value) return;
  tokenStep.value = 1;
  tokenReached.value = Math.max(tokenReached.value, 1);
}

/** Closes the wizard ; a token shown is gone from the page (it was shown once). */
function closeTokenWizard() {
  tokenDialog.value = false;
  tokenResult.value = null;
  tokenForm.value.password = '';
}

function showToken(token) {
  const exp = TokenStorage.decode(token).exp;
  tokenResult.value = {
    token,
    never: neverExpires(exp * 1000),
    expires: Time.format(exp * 1000),
  };
  tokenForm.value.name = '';
  tokensReload.value++;
  // the last step : the token, shown once (also on the way back from an SSO sign-in)
  tokenStep.value = 2;
  tokenReached.value = 2;
  tokenDialog.value = true;
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
    sessionStorage.setItem(
      PENDING_TOKEN,
      JSON.stringify({
        days: tokenForm.value.days,
        name: tokenForm.value.name,
        username: profile.value.username,
        at: Date.now(),
      }),
    );
  } catch {
    // no storage : the user asks again once back
  }
  toast.info(t('profilePage.token.signingInAgain'));
  rememberSsoOrigin('/profile/token');
  const issuer = profile.value.type === 'oidc' ? 'oidc' : 'azuread';
  localStorage.setItem('authIssuer', issuer);
  // reauth : the provider asks for the credentials again (a live provider session would answer
  // without asking), and only that sign-in counts as a recent one
  window.location.replace(`${BaseUrl}/api/v2/auth/${issuer === 'oidc' ? 'oidc' : 'entraid'}?reauth=1`);
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
  if (!pending || !ssoReturning || !(Date.now() - Number(pending.at) < PENDING_MAX_MS)) return;
  await ssoSettled();
  // the user the new session is of (the profile may not be read yet)
  if (pending.username !== TokenStorage.getPayload()?.user?.username) return;
  // a number of days, or 'never' (a token that never expires) : kept as it was asked
  if (pending.days === 'never') tokenForm.value.days = 'never';
  else if (Number(pending.days)) tokenForm.value.days = Number(pending.days);
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
  if (theme === 'system') {
    Theme.chooseBrowser();
  } else if (theme === 'color') {
    Theme.choose('color');
    Theme.applyColor(themeColor.value);
  } else {
    Theme.clearColor();
    Theme.choose(theme);
  }
  followsBrowser.value = Theme.isFollowingBrowser();
}
// the theme the dropdown shows : Follow the browser while it is followed, else the theme ; the
// header's switch picks a theme of its own, so the browser is no longer followed then
const followsBrowser = ref(Theme.isFollowingBrowser());
watch(
  () => store.theme,
  () => {
    followsBrowser.value = Theme.isFollowingBrowser();
  },
);
const themeChoice = computed(() => (followsBrowser.value ? 'system' : store.theme));

// the time zone the whole app shows dates in (lib/Time.js) : UTC, this browser's zone, or any
const timezone = computed({
  get: () => store.timezone || 'UTC',
  set: (value) => Time.setPreference(value),
});
// the date format dates show in : the app's default until the user picks one (lib/Time.js)
// desktop notifications (lib/jobNotifications.js) : only for a user who sees its jobs ; on once
// the browser allows them, off when it blocks them (the note says how to allow them again)
const canNotify = notificationsSupported();
const notifyOn = ref(notificationsActive());
const notifyBlocked = ref(notificationPermission() === 'denied');
async function onNotifySwitch(e) {
  if (!e.target.checked) {
    turnNotificationsOff();
    notifyOn.value = false;
    return;
  }
  const answer = await turnNotificationsOn();
  notifyOn.value = answer === 'granted';
  notifyBlocked.value = answer === 'denied';
  // the switch follows the answer : refused or dismissed, it is off again
  e.target.checked = notifyOn.value;
}
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
// a color still hovered when the page goes : the user's theme again
onBeforeUnmount(() => Theme.endPreview());

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
        :crumbs="crumbs"
        :bare="['account', 'permissions'].includes(currentView)"
      >
        <!-- Preferences' tabs, Password's one, above the page's card -->
        <template v-if="viewTabs.length" #tabs>
          <ul class="nav nav-tabs mb-0">
            <li v-for="tab in viewTabs" :key="tab.key" class="nav-item">
              <a class="nav-link" :class="{ active: prefTab === tab.key }" href="#" @click.prevent="prefTab = tab.key">
                <FaIcon :icon="tab.icon" class="me-1" />
                {{ tab.label }}
              </a>
            </li>
          </ul>
        </template>
        <!-- ===================== account ===================== -->
        <template v-if="currentView === 'account'">
          <div class="card">
            <!-- who : the person's name when the sign-in brought one (ldap, Entra ID, openid
                 connect), else the username - the username itself is a row below. Styled like
                 the permissions tables' headers, without a border-bottom of its own : the list
                 group under it draws that line (a list group in a card takes the card's border
                 on top), so both would double it -->
            <div class="card-body d-flex align-items-center af-identity py-2">
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
                  ><FaIcon :icon="loginType.icon" class="text-body-secondary" style="margin-right: 0.2rem" />{{
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
          <!-- Appearance : the language, the theme and the forms view -->
          <div v-if="prefTab === 'appearance'">
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
            <div class="input-group af-field">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="palette" /></span>
              <select
                class="form-select"
                :value="themeChoice"
                :aria-label="t('profilePage.theme')"
                @change="setTheme($event.target.value)"
              >
                <option value="system">{{ t('settings.settingsPage.themeSystem') }}</option>
                <option v-for="th in Theme.themes()" :key="th.value" :value="th.value">{{ th.title }}</option>
              </select>
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
                @mouseenter="Theme.previewColor(c)"
                @mouseleave="Theme.endPreview()"
                @focus="Theme.previewColor(c)"
                @blur="Theme.endPreview()"
              >
                <FaIcon v-if="themeColor === c" icon="check" />
              </button>
            </div>
            <div class="form-text">{{ t('profilePage.themeHint') }}</div>
            <!-- how the forms page lists the forms -->
            <label class="form-label fw-bold mt-4">{{ t('profilePage.formsView') }}</label>
            <div class="input-group af-field">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="table-cells-large" /></span>
              <select
                class="form-select"
                :value="formsView"
                :aria-label="t('profilePage.formsView')"
                @change="setFormsView($event.target.value)"
              >
                <option value="tiles">{{ t('forms.tiles') }}</option>
                <option value="list">{{ t('forms.list') }}</option>
              </select>
            </div>
            <div class="form-text">{{ t('profilePage.formsViewHint') }}</div>
          </div>
          <!-- Date and time : the time zone and the date format, and the time now in them -->
          <div v-else-if="prefTab === 'datetime'">
            <label class="form-label fw-bold">{{ t('profilePage.timezone') }}</label>
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
            <label class="form-label fw-bold d-block mt-4">{{ t('profilePage.preview') }}</label>
            <AppTimePreview :zone="Time.zone()" :format="Time.datePattern()" />
          </div>
          <!-- Notifications : on this computer, when the user's jobs end or one waits for its approval -->
          <div v-else-if="prefTab === 'notifications'">
            <label class="form-label fw-bold d-block" for="af-job-notifications">{{
              t('profilePage.notifications')
            }}</label>
            <div class="form-check form-switch mb-0">
              <input
                id="af-job-notifications"
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="notifyOn"
                :disabled="!canNotify"
                @change="onNotifySwitch"
              />
            </div>
            <div class="form-text">
              {{
                !canNotify
                  ? t('profilePage.notificationsUnsupported')
                  : notifyBlocked
                    ? t('profilePage.notificationsBlocked')
                    : t('profilePage.notificationsHint')
              }}
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
            <FaIcon icon="circle-info" class="me-2" />{{ t('profilePage.elsewhere', { type: loginType.label }) }}
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
            <div class="card-body d-flex align-items-center justify-content-between af-identity py-2 border-bottom">
              <span class="fw-semibold">{{ group.title }}</span>
              <small class="text-body-secondary">{{
                t('profilePage.allowedCount', { n: group.allowed, total: group.options.length })
              }}</small>
            </div>
            <div class="table-responsive">
              <!-- fixed columns (the styles below), the same in every card : the access at the right edge -->
              <table class="table mb-0 af-perm-table">
                <thead>
                  <tr>
                    <th>{{ t('profilePage.columnSetting') }}</th>
                    <th>{{ t('profilePage.columnDescription') }}</th>
                    <th class="text-end">{{ t('profilePage.columnAccess') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in group.options" :key="o.key">
                    <td>
                      <code class="af-option-key">{{ o.key }}</code>
                    </td>
                    <td :class="o.value ? '' : 'text-body-secondary'">
                      {{ o.description }}
                      <div v-if="o.note" class="small text-body-secondary">{{ o.note }}</div>
                    </td>
                    <td class="text-end">
                      <span class="badge rounded-pill af-pill" :class="o.value ? 'af-pill-green' : 'af-pill-grey'">
                        <FaIcon :icon="o.value ? 'check' : 'xmark'" class="me-1" />{{
                          o.value ? t('profilePage.allowed') : t('profilePage.notAllowed')
                        }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ===================== api token ===================== -->
        <template v-else-if="currentView === 'token'">
          <!-- the tokens made, each to revoke ; New token (top right) opens the wizard -->
          <AppApiTokens
            url="/api/v2/profile/tokens"
            :reload="tokensReload"
            :toolbarTo="'#' + tokenToolsId"
            :pagerTo="'#' + tokenPagerId"
          />
          <!-- the wizard : the token (its name and lifetime), the confirmation (the password, or a
               sign-in again for an SSO account), then the token itself, shown once -->
          <BsModal v-if="tokenDialog" size="lg" icon="code" :footerClose="false" @close="closeTokenWizard">
            <template #title>{{ t('profilePage.token.new') }}</template>
            <!-- its steps, above the fields and out of their scroll -->
            <template #top>
              <AppWizardSteps
                :steps="tokenSteps"
                :current="tokenStep"
                :reached="tokenReached"
                @go="(i) => (tokenStep = i)"
              />
            </template>
            <template #default>
              <div v-if="tokenStep === 2 && tokenResult">
                <label class="form-label fw-semibold" for="af-token">{{
                  tokenResult.never
                    ? t('profilePage.token.createdNever')
                    : t('profilePage.token.created', { date: tokenResult.expires })
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
              </div>
              <!-- the request : a lifetime and the password -->
              <!-- its fields as every dialog's : the name at the left, the field and its help at the right -->
              <div v-else-if="tokenStep === 0">
                <BsInput
                  v-model="tokenForm.name"
                  :isHorizontal="true"
                  :isFloating="false"
                  type="text"
                  icon="tag"
                  :required="true"
                  :label="t('profilePage.token.name')"
                  :help="t('profilePage.token.nameHint')"
                  @keyup_enter="nextTokenStep"
                />
                <BsInput
                  v-model="tokenForm.days"
                  :isHorizontal="true"
                  :isFloating="false"
                  type="select"
                  icon="hourglass-half"
                  :required="true"
                  :values="lifetimeOptions"
                  valueKey="value"
                  labelKey="label"
                  :label="t('profilePage.token.lifetime')"
                  :help="t('profilePage.token.lifetimeHint')"
                />
              </div>
              <form v-else class="af-field" @submit.prevent="createToken" @keydown.enter.prevent="createToken">
                <p v-if="!usesPassword" class="text-body-secondary mb-0">
                  <FaIcon icon="circle-info" class="me-2" />{{
                    t('profilePage.token.signInAgainHint', { type: loginType.label })
                  }}
                </p>
                <BsInput
                  v-else
                  v-model="tokenForm.password"
                  :isHorizontal="true"
                  :isFloating="false"
                  type="password"
                  icon="lock"
                  :required="true"
                  :label="t('profilePage.token.password')"
                  :help="t('profilePage.token.passwordHint')"
                  @keyup_enter="createToken"
                />
              </form>
            </template>
            <template #footer>
              <BsButton v-if="tokenStep === 1" icon="arrow-left" @click="tokenStep = 0">{{
                t('common.previous')
              }}</BsButton>
              <BsButton
                v-if="tokenStep === 0"
                icon="arrow-right"
                :colorClass="tokenNamed ? 'primary' : 'secondary'"
                :disabled="!tokenNamed"
                @click="nextTokenStep"
                >{{ t('common.next') }}</BsButton
              >
              <BsButton
                v-if="tokenStep === 1"
                icon="code"
                :colorClass="canSubmitToken ? 'primary' : 'secondary'"
                :disabled="!canSubmitToken"
                @click="createToken"
                >{{ t('profilePage.token.create') }}</BsButton
              >
              <BsButton icon="times" @click="closeTokenWizard">{{ t('common.close') }}</BsButton>
            </template>
          </BsModal>
        </template>

        <!-- the view's action, where the settings pages put their Save button : below the card,
             on the right, grey until the form can be sent, then the accent color -->
        <!-- the token list's pager, under the card as on the other lists -->
        <template v-if="currentView === 'token'" #footer>
          <div :id="tokenPagerId"></div>
        </template>
        <!-- the token list's search and buttons, on the title line as on the other lists -->
        <template v-if="currentView === 'token'" #headerActions>
          <div :id="tokenToolsId" class="af-title-flow"></div>
        </template>
        <template v-if="(currentView === 'password' && isLocal) || currentView === 'token'" #actions>
          <BsButton
            v-if="currentView === 'password'"
            icon="key"
            :colorClass="canSavePassword ? 'primary' : 'secondary'"
            :disabled="!canSavePassword"
            @click="changePassword"
            >{{ t('profilePage.change') }}</BsButton
          >
          <BsButton v-else icon="plus" @click="openTokenWizard">{{ t('profilePage.token.new') }}</BsButton>
        </template>
      </AppSettings>
    </main>
  </div>
</template>

<style scoped lang="scss">
// the identity band at the top of the account card
/* the line under the account's header : a table's light line (the list under it takes the card's
   darker border on top otherwise) */
.af-identity + .list-group {
  border-top-color: var(--bs-border-color);
}
/* a card's header (the account's name, a permission group's name and count) : as tall as a table's
   header (py-2 on it), its grey */
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

// one width for the fields of every view (password, api token, preferences) ; in a form (and
// the New token wizard's details) only its fields have that width, so their help text below can
// use the whole width, as in the preferences cards
.af-field {
  max-width: 480px;
}
form.af-field,
.af-field.af-field-help-wide {
  max-width: none;
  .input-group {
    max-width: 480px;
  }
}
.af-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 420px;
}
// round, as the header's theme menu (components/BsThemeSwitcher.vue)
.af-swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #ffffff;
  font-size: 0.65rem;
  transition:
    transform 0.15s,
    border-color 0.15s;
  &:hover {
    transform: scale(1.2);
  }
  &.active {
    border-color: var(--bs-body-color);
    box-shadow: 0 0 0 2px var(--bs-body-bg);
  }
  svg {
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
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
