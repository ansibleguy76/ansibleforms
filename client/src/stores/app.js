// Utilities
import { defineStore, getActivePinia } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

// the user's time zone preference, kept in this browser like the theme ; storage can be
// unavailable (private mode), then the default applies
function loadTimezone() {
  try {
    return localStorage.getItem('af_timezone') || 'UTC';
  } catch {
    return 'UTC';
  }
}

// the user's date format, kept in this browser like the time zone ; none : the app's default
function loadDateFormat() {
  try {
    return localStorage.getItem('af_date_format') || 'YYYY-MM-DD';
  } catch {
    return 'YYYY-MM-DD';
  }
}

export const useAppStore = defineStore('app', () => {
  const theme = ref('light'); // default theme
  const profile = ref(null);
  const authenticated = ref(false);
  const isAdmin = ref(false);
  const version = ref('');
  const customLogo = ref(null); // logo data url shown in the navbar
  const logoIsDefault = ref(true); // true while the seeded default logo is active
  const customFavicon = ref(null); // the website icon's data url ; null : the bundled one
  const serverBuild = ref(null);
  const clientBuild = ref(null);
  const approvals = ref(0);
  // the designer lock as /api/v2/lock answers it ({ free } or { lock, match }) : the lock icon
  // on the header's Designer link ; null while unknown or for a user without the designer
  const designerLock = ref(null);
  const errorMessage = ref('');
  const schemaData = ref(null);
  const chatEnabled = ref(false); // ENABLE_CHAT and a configured provider (/api/v2/app/config)
  const designerEnabled = ref(true); // SHOW_DESIGNER : the designer there at all (/api/v2/app/config)
  const appConfigLoaded = ref(false); // /api/v2/app/config read at least once (State.loadAppConfig)
  // Settings > Appearance (/api/v2/app/config) : the name in the browser tab and on
  // the sign-in page, the label beside the logo and its colour, the announcement under the
  // header ({ message, level, until } while it runs), the forms list's view for everyone
  const appName = ref(null);
  const envLabel = ref(null);
  const envLabelColor = ref(null);
  const banner = ref(null);
  const formsView = ref(null);
  // the header's own links (Settings > Appearance > Links > Custom), for who is signed in
  const headerLinks = ref([]);
  // the time zone dates are shown in : 'UTC', 'browser' or an IANA zone (lib/Time.js) ; read
  // here so every page re-renders its dates when the user picks another one
  const timezone = ref(loadTimezone());
  // the date format dates are shown in (lib/Time.js) : the user's, else the app's default
  const dateFormat = ref(loadDateFormat());
  // the server runs a newer build than this tab (App.vue's response interceptor) ; the banner
  // under the header offers a reload, and can be dismissed for the rest of this visit
  const newVersionAvailable = ref(false);
  const newVersionDismissed = ref(false);

  // const doubleCount = computed(() => count.value * 2)
  // function increment() {
  //   count.value++
  // }

  return {
    theme,
    profile,
    authenticated,
    isAdmin,
    version,
    customLogo,
    logoIsDefault,
    customFavicon,
    serverBuild,
    clientBuild,
    approvals,
    designerLock,
    errorMessage,
    schemaData,
    chatEnabled,
    designerEnabled,
    appConfigLoaded,
    appName,
    envLabel,
    envLabelColor,
    banner,
    formsView,
    headerLinks,
    timezone,
    dateFormat,
    newVersionAvailable,
    newVersionDismissed,
  };
});

/**
 * Whether the designer is switched off for the instance (SHOW_DESIGNER, /api/v2/app/config) : then
 * no one sees it, whatever their role options. False before the store exists (a test, an early
 * route check).
 *
 * Returns:
 *   boolean: true when switched off.
 */
export function designerSwitchedOff() {
  if (!getActivePinia()) return false;
  return useAppStore().designerEnabled === false;
}

// the one read of /api/v2/app/config a route check may wait for, shared by the checks of one load
let appConfigRead = null;

/**
 * Whether the designer is switched off for the instance, read from the server first when the app
 * has not read it yet (a fresh tab opened on /designer).
 *
 * Returns:
 *   Promise<boolean>: true when switched off.
 */
export async function designerSwitchedOffNow() {
  if (!getActivePinia()) return false;
  const store = useAppStore();
  if (!store.appConfigLoaded) {
    appConfigRead =
      appConfigRead ||
      axios
        .get('/api/v2/app/config')
        .then((res) => {
          store.designerEnabled = res.data?.designerEnabled !== false;
          store.appConfigLoaded = true;
        })
        .catch(() => {});
    await appConfigRead;
  }
  return store.designerEnabled === false;
}
