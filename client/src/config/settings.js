// These settings define the gui admin pages
// Accepts a t() function from vue-i18n for translations
import { editorStyle } from './editorStyle';
import YAML from 'yaml';
import axios from 'axios';
import Helpers from '@/lib/Helpers';
import { cronCell } from '@/lib/cronCell';
import { cronValidationMessage } from './cron';
import { PILL, pill, esc } from '@/lib/tableCells';
import { formPath } from '@/lib/formsPath';
import { ssoCallbackUrl, SSO_EXAMPLE_BASE } from '@/lib/ssoCallback';

// A cron field is validated with the SAME check the editor uses (config/cron.js), which
// is the only thing that keeps the two from disagreeing.
//
// It used to be a hand written regex here. A regex cannot compare the two ends of a range,
// so `0 0 * * 5-1` passed the save validator and croner then refused it - cron.service.js
// logs 'Invalid cron expression' and returns, so the row saved and the job was never
// registered, with nothing on screen to say the repository had stopped syncing. The regex
// also rejected the month and weekday NAMES that croner accepts and that BsCron already
// previewed as valid, so the editor described a schedule the form then refused to save.
//
// The server refuses a bad expression too (lib/cronValidate.js, called from CrudModel), so
// this is the early, explanatory answer rather than the only line of defence.
const cronValidator = (t) => (value) => cronValidationMessage(t, value);

// The chat assistant's providers (server/src/chat/vendors.js has the same list and defaults) :
// choosing one fills in its base url, auth type and api version, which stay editable
export const CHAT_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic', base_url: 'https://api.anthropic.com' },
  { value: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1' },
  { value: 'azure', label: 'Azure OpenAI', base_url: '', auth_type: 'api-key', api_version: '2024-10-21' },
  { value: 'gemini', label: 'Google Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { value: 'grok', label: 'xAI Grok', base_url: 'https://api.x.ai/v1' },
  { value: 'mistral', label: 'Mistral', base_url: 'https://api.mistral.ai/v1' },
  { value: 'deepseek', label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1' },
  { value: 'groq', label: 'Groq', base_url: 'https://api.groq.com/openai/v1' },
  { value: 'openrouter', label: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1' },
  { value: 'ollama', label: 'Ollama', base_url: 'http://localhost:11434/v1', auth_type: 'none' },
  { value: 'custom', base_url: '' },
];

// The secret store types (server/src/secrets/providers/index.js has the same list)
// for render() output, which goes to v-html : nothing reaches it unescaped, a locale string included
const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Where a user or a group comes from, in words : Local, LDAP, Entra ID, OIDC.
 *
 * Args:
 *   t (function): the vue-i18n translate function.
 *   source (string): local, ldap, azuread or oidc.
 *
 * Returns:
 *   string: its name ; the source itself when unknown.
 */
export function sourceLabel(t, source) {
  const key = { local: 'sourceLocal', ldap: 'sourceLdap', azuread: 'sourceAzuread', oidc: 'sourceOidc' }[source];
  return key ? t(`settings.directory.${key}`) : String(source ?? '');
}

/**
 * The page of a user or a group from a directory (LDAP, Entra ID, OIDC) : its source and name in
 * the address, the name url-encoded (an Entra ID upn holds an @).
 *
 * Args:
 *   kind (string): users or groups.
 *   item (object): the row, { source, username or name }.
 *
 * Returns:
 *   string: /settings/<kind>/<source>/<name>.
 */
export function directoryPath(kind, item) {
  return `/settings/${kind}/${item.source}/${encodeURIComponent(item.username ?? item.name)}`;
}

/**
 * The empty value of a pill column (a schedule that never ran) : an en dash in a pill with no
 * colour of its own - the text's - so it lines up with the other rows' pill text rather than
 * starting at their edge, without looking like a value.
 *
 * Returns:
 *   string: the pill's HTML.
 */
export function emptyPill() {
  return `<span class="badge rounded-pill af-pill af-pill-empty"><span class="af-pill-label">–</span></span>`;
}

/**
 * A status as a pill of the shared tables, the colors of the audit log's outcomes : running in
 * blue, success in green, failed in red, anything else grey ; none, an en dash.
 *
 * Args:
 *   t (function): the vue-i18n translate function.
 *   value (string): the status (running, success, failed...).
 *
 * Returns:
 *   string: the cell's HTML, escaped.
 */
export function statusPill(t, value) {
  if (!value) return emptyPill();
  const known = { running: PILL.blue, success: PILL.green, failed: PILL.red };
  const label = known[value] ? t(`jobs.menu.${value}`) : value;
  return pill(known[value], label);
}

/**
 * A repository's last pull as a pill : running blue, success green, failed red ; never pulled
 * (no status yet) an en dash. Its clone, sync and reset write the same status. When it ended
 * follows it, grey.
 *
 * Args:
 *   t (function): the translation function.
 *   repo (object): the repository, with status (its last pull) and pulled_at.
 *   withDate (boolean): when it ended beside it (the repository's page ; not the list's table).
 *
 * Returns:
 *   string: the pill's markup.
 */
export function repositoryPullPill(t, repo, withDate = true) {
  return statusPill(t, repo?.status) + (withDate ? pillDate(repo?.pulled_at) : '');
}

/**
 * When a repository's last pull or push ended, beside its pill : grey, in the user's zone and date
 * format ; nothing when it never ran.
 *
 * Args:
 *   value (string): the server's timestamp, or none.
 *
 * Returns:
 *   string: the date's markup, escaped, or ''.
 */
function pillDate(value) {
  const text = value ? Helpers.formatServerDate(value) : '';
  return text ? ` <span class="af-pill-date">${esc(text)}</span>` : '';
}

/**
 * A repository's push as a pill : its last push failed red ; else changes saved here and not
 * pushed yet, pending changes in the designer's push orange (something waits) ; else its last
 * push worked, success green ; never pushed (or a repository the app does not write to) an en
 * dash, as a pull that never ran. When the last push ended follows it, grey.
 *
 * Args:
 *   t (function): the translation function.
 *   repo (object): the repository, with unpushed, push_status and pushed_at.
 *   withDate (boolean): when it ended beside it (the repository's page ; not the list's table).
 *
 * Returns:
 *   string: the pill's markup.
 */
export function repositoryPushPill(t, repo, withDate = true) {
  const date = withDate ? pillDate(repo?.pushed_at) : '';
  if (repo?.push_status === 'failed') return statusPill(t, 'failed') + date;
  if (repo?.unpushed) {
    return pill(PILL.unpushed, t('settings.repositories.notPushed'), t('settings.repositories.notPushedHint')) + date;
  }
  return repo?.push_status === 'success' ? statusPill(t, 'success') + date : emptyPill();
}

/**
 * A runner's registration as a pill, as a repository's status : automatic (its RTE registered
 * it and writes its heartbeat) blue, unresponsive (the heartbeat stopped, removed after 10
 * minutes) amber, manual (added by hand, through the api or by the config seed) grey.
 *
 * Args:
 *   t (function): the translation function.
 *   state (string): automatic, unresponsive, or none (manual).
 *
 * Returns:
 *   string: the pill's HTML, escaped.
 */
/**
 * A schedule's state as a pill : running (a run in progress) blue, queued (waiting for a
 * worker) amber, idle grey ; none an en dash.
 *
 * Args:
 *   t (function): the translation function.
 *   state (string): idle, queued or running.
 *
 * Returns:
 *   string: the pill's HTML, escaped.
 */
export function schedulePill(t, state) {
  // never run : waiting for its time, idle
  if (!state) state = 'idle';
  const known = { running: PILL.blue, queued: PILL.amber, idle: PILL.grey };
  const label = known[state] ? t(`settings.schedules.state_${state}`) : state;
  return pill(known[state], label);
}

// ─── SSO providers (Access > SSO) ────────────────────────────────────────────
// the types a provider can be, in the order the wizard offers them
export const SSO_TYPES = ['azuread', 'oidc'];

// ─── notification channels (Connections > Notifications) ─────────────────────
// the types a channel can be, in the order the wizard offers them, and each one's icon
export const CHANNEL_TYPES = ['mail', 'slack', 'teams', 'telegram', 'webhook'];
export const CHANNEL_ICONS = {
  mail: 'envelope',
  slack: 'fab,slack',
  teams: 'fab,microsoft',
  telegram: 'fab,telegram',
  webhook: 'globe',
};
// the placeholders a webhook's payload may use, as its help lists them (written out here : the
// translations cannot hold a brace)
export const PAYLOAD_PLACEHOLDERS = ['title', 'text', 'status', 'event', 'jobId', 'form', 'user', 'link']
  .map((name) => `{{${name}}}`)
  .join(', ');
// the body a webhook channel sends when it has none of its own (models/notificationChannel.js)
export const DEFAULT_PAYLOAD = `{
  "title": "{{title}}",
  "text": "{{text}}",
  "status": "{{status}}",
  "event": "{{event}}",
  "job": { "id": "{{jobId}}", "form": "{{form}}", "user": "{{user}}" },
  "link": "{{link}}"
}`;

/**
 * A channel's type : one of CHANNEL_TYPES, mail when it has none yet.
 *
 * Args:
 *   item (object): the channel (or the one being made).
 *
 * Returns:
 *   string: its type.
 */
export function channelType(item) {
  return CHANNEL_TYPES.includes(item?.type) ? item.type : 'mail';
}

/**
 * Where a channel sends, as the list shows it : a mail server's host and port, a webhook's host,
 * a Telegram chat ; a Slack or Teams webhook's address is a secret, so only its kind.
 *
 * Args:
 *   t (function): the translation function.
 *   row (object): the channel.
 *
 * Returns:
 *   string: the address.
 */
export function channelAddress(t, row) {
  const type = channelType(row);
  if (type === 'mail') return row?.server ? `${row.server}:${row.port || 25}` : '';
  if (type === 'slack' || type === 'teams') return t('settings.notificationChannels.addressWebhook');
  if (type === 'telegram')
    return row?.chat_id ? t('settings.notificationChannels.addressChat', { chat: row.chat_id }) : '';
  try {
    return new URL(row?.url).host;
  } catch {
    return row?.url || '';
  }
}

/**
 * What a syslog server gets, as text : the audit log, the server log, or both.
 *
 * Args:
 *   t (function): the translation function.
 *   value (string): log, audit or both.
 *
 * Returns:
 *   string: the label, escaped.
 */
export function syslogReceivesText(t, value) {
  const key = ['log', 'audit', 'both'].includes(value) ? value : 'both';
  return esc(t(`settings.syslogServers.receives_${key}`));
}

/**
 * Where a syslog server listens, as its table shows it : host:port, or the socket's path.
 *
 * Args:
 *   server (object): the server.
 *
 * Returns:
 *   string: the address.
 */
export function syslogAddress(server) {
  if (String(server?.protocol || '').startsWith('unix')) return server?.path || '';
  return server?.host ? `${server.host}:${server.port || 514}` : '';
}

export function registrationPill(t, state) {
  const known = { automatic: PILL.blue, unresponsive: PILL.amber };
  const key = known[state] ? state : 'manual';
  const label = t(`settings.runners.state${key[0].toUpperCase()}${key.slice(1)}`);
  return pill(known[state], label);
}

/**
 * An announcement's type as a pill, in its colour : info blue, warning amber, danger red.
 *
 * Args:
 *   t (function): the translation function.
 *   level (string): info, warning or danger.
 *
 * Returns:
 *   string: the pill's HTML, escaped.
 */
export function announcementLevelPill(t, level) {
  const known = { info: PILL.blue, warning: PILL.amber, danger: PILL.red };
  const key = known[level] ? level : 'info';
  return pill(known[key], t(`settings.interface.banner_${key}`));
}

// how a user signed in, as the disclaimer's acceptances name it
export const SIGN_IN_TYPES = { local: 'Local', ldap: 'LDAP', azuread: 'Microsoft Entra ID', oidc: 'OpenID Connect' };

// what a credential is for (its type), in the order the dialog offers them
// userpass : a user and a password for any login, the default ; ssh : one for SSH to a server
export const CREDENTIAL_TYPES = [
  'userpass',
  'ssh',
  'git',
  'api',
  'database',
  'cyberark',
  'smtp',
  'ldap',
  'entraid',
  'oidc',
];

// The flavours of an awx runner (server/src/models/runner.model.js has the same list) : which
// product it is (its uri carries its API path)
export const RUNNER_FLAVOURS = [
  { value: null, label: 'AWX' },
  { value: 'aap', label: 'Ansible Automation Platform' },
  { value: 'ascender', label: 'Ascender' },
];

// what a runner is, in the dialog : an RTE, an awx runner of one of its flavours (none is
// AWX), a Semaphore UI, a Rundeck or a Jenkins - stored as its type and flavour
// (the RTE first, the others alphabetically)
export const RUNNER_KINDS = ['rte', 'aap', 'ascender', 'awx', 'jenkins', 'rundeck', 'semaphore'];
// the kinds that are a type of their own, signed in with a token and launching in one project (a
// Jenkins : in a folder, if any, and with its user as well)
export const PROJECT_RUNNER_KINDS = ['semaphore', 'rundeck', 'jenkins'];
// the kinds of an awx runner : a token, or a user and password
export const AWX_RUNNER_KINDS = ['awx', 'aap', 'ascender'];
// an example address of each kind : an awx runner's with its API path (AAP 2.5+ behind its
// gateway)
const RUNNER_URI_EXAMPLE = {
  rte: 'https://rte-vmware:8000',
  awx: 'https://awx.example.com/api/v2',
  aap: 'https://aap.example.com/api/controller/v2',
  ascender: 'https://ascender.example.com/api/v2',
  semaphore: 'https://semaphore.example.com',
  rundeck: 'https://rundeck.example.com',
  jenkins: 'https://jenkins.example.com',
};

/**
 * A runner's kind, from its type and flavour.
 *
 * Args:
 *   r (object): the runner (type, flavour) ; none for a new one.
 *
 * Returns:
 *   string: rte, awx, aap, ascender, semaphore, rundeck or jenkins.
 */
export function runnerKind(r) {
  if (!r?.type || r.type === 'rte') return 'rte';
  if (PROJECT_RUNNER_KINDS.includes(r.type)) return r.type;
  return ['aap', 'ascender'].includes(r.flavour) ? r.flavour : 'awx';
}

export const SECRET_STORE_TYPES = [
  { value: 'vault', label: 'HashiCorp Vault' },
  { value: 'cyberark_ccp', label: 'CyberArk Central Credential Provider', short: 'CyberArk CCP' },
];

export default function getSettings(t) {
  const all = {
    users: {
      type: 'user',
      route: 'users',
      label: t('settings.users.label'),
      description: t('settings.users.description'),
      icon: 'user',
      selectable: false,
      // the LDAP and SSO users beside the local ones (seen at sign-in, or named by a role)
      listQuery: '?directory=1',
      // a user has its own page (pages/admin/user.vue ; an LDAP or SSO user's
      // pages/admin/directory-user.vue) : its row and Edit open it, New the wizard
      openPage: (item) =>
        !item.source || item.source === 'local' ? `/settings/users/${item.id}` : directoryPath('users', item),
      // the dialog in steps : who the user is, the password (editing : left empty, it stays), the
      // group that gives the roles
      steps: [
        { key: 'user', label: t('settings.users.stepUser') },
        { key: 'password', label: t('settings.users.stepPassword') },
        { key: 'group', label: t('settings.users.stepGroup') },
      ],
      // in the row menu : editing, the groups, the password, then Delete last, each apart
      actions: [
        { name: 'edit', title: t('settings.users.editUser'), icon: 'pencil', color: 'edit' },
        // the user's Groups tab, its Add group dialog open
        {
          name: 'add_group',
          title: t('settings.users.addToGroup'),
          icon: 'users',
          color: 'edit',
          dividerBefore: true,
          to: (u) => ({ path: `/settings/users/${u.id}/groups`, query: { add: '1' } }),
          // a local user's : an LDAP or SSO user's groups come from its directory
          shownWhen: (u) => !u.source || u.source === 'local',
        },
        {
          name: 'change_password',
          title: t('settings.common.changePassword'),
          icon: 'lock',
          color: 'change',
          dividerBefore: true,
          // a local user's : an LDAP or SSO user's password is its directory's
          shownWhen: (u) => !u.source || u.source === 'local',
        },
        // its sign-in, for every user : blocked (asked first, users.vue) or allowed again ; never
        // the admin user, the way back in
        {
          name: 'block_sign_in',
          title: t('settings.directory.blockSignIn'),
          icon: 'ban',
          color: 'change',
          dividerBefore: true,
          shownWhen: (u) => !u.blocked && !(u.username === 'admin' && (!u.source || u.source === 'local')),
        },
        {
          name: 'allow_sign_in',
          title: t('settings.directory.allowSignIn'),
          icon: 'circle-check',
          color: 'change',
          dividerBefore: true,
          shownWhen: (u) => !!u.blocked,
        },
        {
          name: 'delete',
          title: t('settings.users.deleteUser'),
          icon: 'trash',
          color: 'delete',
          // the admin user is the way back in : never deleted (the server refuses it too) ; an
          // LDAP or SSO user is forgotten from its page, never deleted here
          enabledWhen: (u) => u.username !== 'admin' && (!u.source || u.source === 'local'),
          shownWhen: (u) => !u.source || u.source === 'local',
        },
      ],
      fields: [
        {
          key: 'id',
          label: t('settings.fields.id'),
          sortable: false,
          required: false,
          filterable: false,
          noInput: true,
          hidden: true,
          icon: 'key',
        },
        {
          key: 'username',
          label: t('settings.fields.username'),
          sortable: true,
          required: true,
          filterable: true,
          icon: 'user',
        },
        // where the user comes from : local, or its directory (LDAP, Entra ID, OIDC) ; an LDAP or
        // SSO user's sign-in blocked, or never signed in, said beside it
        {
          key: 'source',
          label: t('settings.directory.source'),
          noInput: true,
          sortable: true,
          filterable: true,
          render: (v, row) =>
            escapeHtml(sourceLabel(t, v || 'local')) +
            (row?.blocked
              ? ` <span class="badge af-blocked-badge ms-2">${escapeHtml(t('settings.directory.blockedShort'))}</span>`
              : v && v !== 'local' && !row?.seen
                ? ` <span class="badge af-required-badge ms-2">${escapeHtml(t('settings.directory.neverSignedIn'))}</span>`
                : ''),
        },
        // who the user is, or what the account is for (a service account)
        {
          key: 'description',
          label: t('settings.fields.description'),
          sortable: true,
          required: false,
          filterable: true,
          icon: 'info-circle',
        },
        {
          key: 'password',
          step: 'password',
          // shown when editing too, as ******** : left empty, the stored one stays
          onEdit: true,
          label: t('settings.fields.password'),
          type: 'password',
          sortable: false,
          required: true,
          filterable: false,
          hidden: true,
          icon: 'lock',
        },
        {
          key: 'email',
          label: t('settings.fields.email'),
          type: 'email',
          sortable: false,
          required: false,
          filterable: true,
          icon: 'envelope',
        },
        {
          key: 'group_id',
          // in the dialog, not in the table : the user's page has a Groups tab
          noTable: true,
          step: 'group',
          label: t('settings.fields.group'),
          type: 'select',
          sortable: false,
          required: true,
          filterable: true,
          icon: 'users',
          parent: 'group',
          values: 'group',
          valueKey: 'id',
          labelKey: 'name',
        },
        // how many groups the user is in : a column, last, to the right ; not in the dialog
        {
          key: 'group_ids',
          label: t('sidebar.groups'),
          noInput: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          sortValue: (row) => (row.group_ids || []).length,
          render: (v) => String((v || []).length),
        },
        // how many roles the user has, default included (the server counts them, lib/roleCounts.js)
        {
          key: 'role_count',
          label: t('settings.settingsPage.roles'),
          noInput: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          render: (v) => (v ? String(v) : '–'),
        },
        // how many stored jobs it keeps, and how many jobs it planned with Run later (the server
        // counts them, lib/jobCounts.js) : off by default, the Columns menu shows them
        {
          key: 'stored_job_count',
          label: t('settings.storedJobs.labelPlural'),
          noInput: true,
          hidden: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          render: (v) => (v ? String(v) : '–'),
        },
        {
          key: 'schedule_count',
          label: t('settings.schedules.labelPlural'),
          noInput: true,
          hidden: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          render: (v) => (v ? String(v) : '–'),
        },
      ],
    },
    groups: {
      type: 'group',
      label: t('settings.groups.label'),
      description: t('settings.groups.description'),
      icon: 'users',
      selectable: false,
      children: [
        {
          type: 'user',
          label: t('settings.users.label'),
          labelPlural: t('settings.users.labelPlural'),
          icon: 'user',
          // every group of a user (its first one and the others), not its first only
          key: 'group_ids',
        },
      ],
      // the LDAP and SSO groups beside the local ones (seen at a sign-in, or named by a role)
      listQuery: '?directory=1',
      // a group has its own page (pages/admin/group.vue ; an LDAP or SSO group's
      // pages/admin/directory-group.vue) : its row and Edit open it, New the dialog
      openPage: (item) =>
        !item.source || item.source === 'local' ? `/settings/groups/${item.id}` : directoryPath('groups', item),
      // in the row menu : editing, its users, then Delete last, each apart
      actions: [
        { name: 'edit', title: t('settings.groups.editGroup'), icon: 'pencil', color: 'edit' },
        // the group's Users tab, its Add user dialog open
        {
          name: 'add_user',
          title: t('settings.groups.addUserToGroup'),
          icon: 'user',
          color: 'edit',
          dividerBefore: true,
          to: (g) => ({ path: `/settings/groups/${g.id}/users`, query: { add: '1' } }),
          // its users come from its directory
          enabledWhen: (g) => !g.source || g.source === 'local',
        },
        {
          name: 'delete',
          title: t('settings.groups.deleteGroup'),
          icon: 'trash',
          color: 'delete',
          // the admins group is never deleted (the server refuses it too) ; an LDAP or SSO group
          // lives in its directory
          enabledWhen: (g) => g.name !== 'admins' && (!g.source || g.source === 'local'),
        },
      ],
      fields: [
        {
          key: 'id',
          label: t('settings.fields.id'),
          sortable: false,
          required: false,
          filterable: false,
          noInput: true,
          hidden: true,
          icon: 'key',
        },
        {
          key: 'name',
          // as wide as the longest name (v-fit-columns), the spacer after the counts
          label: t('settings.fields.name'),
          sortable: true,
          required: true,
          filterable: true,
          icon: 'users',
        },
        // where the group comes from : local, or its directory (LDAP, Entra ID, OIDC)
        {
          key: 'source',
          label: t('settings.directory.source'),
          noInput: true,
          sortable: true,
          filterable: true,
          render: (v) => escapeHtml(sourceLabel(t, v || 'local')),
        },
        // what the group is for, or who owns it
        {
          key: 'description',
          label: t('settings.fields.description'),
          sortable: true,
          required: false,
          filterable: true,
          icon: 'info-circle',
        },
        // how many users are in the group (the server counts them) : a column, last, to the right
        {
          key: 'user_count',
          label: t('settings.users.labelPlural'),
          noInput: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          // none : an en dash, as the other empty cells
          render: (v) => (v ? String(v) : '–'),
        },
        // how many roles name the group (the server counts them, lib/roleCounts.js)
        {
          key: 'role_count',
          label: t('settings.settingsPage.roles'),
          noInput: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          render: (v) => (v ? String(v) : '–'),
        },
      ],
      childFields: {
        user: [
          { key: 'username', label: t('settings.fields.username') },
          { key: 'email', label: t('settings.fields.email') },
          { key: 'group_id', label: t('settings.fields.group'), hidden: true },
        ],
      },
    },
    repositories: {
      type: 'repository',
      label: t('settings.repositories.label'),
      labelPlural: t('settings.repositories.labelPlural'),
      description: t('settings.repositories.description'),
      // reloadSeconds: 7,
      icon: 'fab,git',
      idKey: 'name',
      selectable: false,
      // a row opens the repository's page
      openPage: (item) => `/settings/repositories/${item.id}`,
      // Scheduled pull off : no schedule ; the switch itself is not stored
      beforeSave: ({ pull_scheduled, ...item }) => (pull_scheduled ? item : { ...item, cron: '' }),
      // the dialog in steps : what the repository is, the credentials to reach it, what it is used
      // for, when it syncs
      steps: [
        { key: 'repository', label: t('settings.repositories.stepRepository') },
        { key: 'credentials', label: t('settings.repositories.stepCredentials') },
        { key: 'usage', label: t('settings.repositories.stepUsage') },
        { key: 'schedule', label: t('settings.repositories.stepSchedule') },
      ],
      actions: [
        // in the row menu : editing, then git (Pull, Push, Reset), then its credentials, then its
        // output (both on its page), then Delete last, each apart ; the same icons as its page's buttons
        { name: 'edit', icon: 'pencil', title: t('settings.repositories.editRepository'), color: 'edit' },
        {
          name: 'trigger',
          icon: 'download',
          title: t('settings.repositories.pull'),
          color: 'test',
          dividerBefore: true,
        },
        {
          // only a repository the designer writes to (forms, settings, playbooks, workflows) is pushed
          // back, and only when it has changes not pushed yet
          name: 'sync',
          enabledWhen: (r) => !!r.unpushed,
          icon: 'upload',
          title: t('settings.repositories.push'),
          color: 'test',
          dependency: [
            'use_for_forms',
            'use_for_config',
            'use_for_playbooks',
            'use_for_workflows',
            'use_for_inventories',
          ],
        },
        { name: 'reset', icon: 'redo', title: t('settings.repositories.reset'), color: 'refresh' },
        {
          // the credential git uses : its page's Credentials tab
          name: 'change_credentials',
          icon: 'key',
          title: t('settings.repositories.changeCredentials'),
          color: 'change',
          dividerBefore: true,
          to: (r) => `/settings/repositories/${r.id}/credentials`,
        },
        {
          // what git said on the last pull : its page's Last pull output tab
          name: 'preview',
          icon: 'terminal',
          title: t('settings.repositories.showPullOutput'),
          color: 'preview',
          dividerBefore: true,
          to: (r) => `/settings/repositories/${r.id}/pull-output`,
        },
        {
          // and on the last push : its page's Last push output tab
          name: 'preview_push',
          icon: 'terminal',
          title: t('settings.repositories.showPushOutput'),
          color: 'preview',
          to: (r) => `/settings/repositories/${r.id}/push-output`,
        },
        { name: 'delete', icon: 'trash', title: t('settings.repositories.deleteRepository'), color: 'delete' },
      ],
      fields: [
        // no columns : the id, and git's output (on the repository's page)
        { key: 'id', hidden: true, noInput: true, noTable: true },
        { key: 'pull_output', hidden: true, noInput: true, noTable: true },
        { key: 'push_output', hidden: true, noInput: true, noTable: true },
        {
          key: 'name',
          icon: 'heading',
          // on a narrow table the head, then the branch, are left out (hideBelow) so the name and
          // the description keep their room
          label: t('settings.fields.name'),
          placeholder: 'my_repo_name',
          readonly: false,
          required: true,
          help: t('settings.repositories.helpName'),
        },
        {
          key: 'description',
          icon: 'info-circle',
          label: t('settings.fields.description'),
          placeholder: t('settings.fields.description'),
          required: true,
        },
        {
          key: 'branch',
          icon: 'code-branch',
          // left out on a narrow table, after the head
          hideBelow: 740,
          label: t('settings.fields.branch'),
          placeholder: 'main',
          readonly: false,
          required: true,
        },
        // a commit's 7 characters
        { key: 'head', label: t('settings.fields.head'), noInput: true, hideBelow: 900 },
        // its last pull (clone, sync or reset) : running, success or failed
        {
          key: 'status',
          label: t('settings.fields.pull'),
          noInput: true,
          render: (v, row) => repositoryPullPill(t, row, false),
          sortValue: (r) => ({ failed: 0, running: 1, success: 2 })[r.status] ?? 3,
        },
        // its push : changes saved here (the designer's Save) and not pushed yet, or none
        {
          key: 'unpushed',
          label: t('settings.fields.push'),
          noInput: true,
          render: (v, row) => repositoryPushPill(t, row, false),
          sortValue: (r) => (r.push_status === 'failed' ? 0 : r.unpushed ? 1 : r.push_status === 'success' ? 2 : 3),
        },
        {
          // a credential of Connections > Credentials, or a New one : the user and password git
          // uses
          key: 'credential',
          step: 'credentials',
          icon: 'key',
          label: t('settings.repositories.credential'),
          help: t('settings.repositories.helpCredential'),
          type: 'select',
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          hidden: true,
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          // a credential for git
          createDefaults: { credential_type: 'git' },
        },
        {
          key: 'user',
          // in the credential now ; kept on the record for the repositories that still have one,
          // no column
          noInput: true,
          noTable: true,
          icon: 'user',
          label: t('settings.fields.username'),
          placeholder: 'my-user',
          hidden: true,
        },
        {
          key: 'password',
          // in the credential now : on no step of the dialog, only behind Change password for the
          // repositories that still have their own
          step: 'own',
          icon: 'lock',
          label: t('settings.fields.password'),
          type: 'password',
          placeholder: t('settings.repositories.placeholderPassword'),
          hidden: true,
        },
        {
          key: 'uri',
          icon: 'fab,git',
          label: t('settings.fields.uri'),
          placeholder: 'https://github.com/account/repo.git',
          required: true,
          hidden: true,
          help: t('settings.repositories.helpUri'),
        },
        {
          // pulled on a schedule or not : not stored, read from the schedule (beforeSave clears
          // the schedule when off)
          key: 'pull_scheduled',
          step: 'schedule',
          type: 'checkbox',
          // at the dialog's left edge, its help on one line
          flush: true,
          label: t('settings.repositories.scheduledPull'),
          help: t('settings.repositories.helpScheduledPull'),
          hidden: true,
          noTable: true,
          initial: (r) => !!(r?.cron && String(r.cron).trim()),
        },
        {
          key: 'cron',
          step: 'schedule',
          icon: 'stopwatch',
          // under Scheduled Pull : what it schedules is said there
          label: t('settings.repositories.stepSchedule'),
          type: 'cron',
          hidden: true,
          // only with Scheduled pull on, and then needed : the switch on with no schedule
          // would save as off
          dependency: 'pull_scheduled',
          required: true,
          validator: cronValidator(t),
        },
        {
          key: 'rebase_on_start',
          step: 'schedule',
          type: 'checkbox',
          flush: true,
          label: t('settings.repositories.cloneOnStart'),
          columnLabel: t('settings.repositories.cloneOnStartShort'),
          help: t('settings.repositories.helpCloneOnStart'),
          hidden: true,
        },
        {
          key: 'use_for_config',
          step: 'usage',
          // the app uses one repository for it
          oneOnly: true,
          shortLabel: t('settings.repositories.useConfigShort'),
          shortHint: t('settings.repositories.useConfigHint'),
          isSwitch: false,
          type: 'checkbox',
          label: t('settings.repositories.useForConfig'),
          // the column : its short name, as on the Usage step
          columnLabel: t('settings.repositories.useConfigShort'),
          help: t('settings.repositories.helpUseForConfig'),
          hidden: true,
        },
        {
          key: 'use_for_forms',
          step: 'usage',
          shortLabel: t('settings.repositories.useFormsShort'),
          shortHint: t('settings.repositories.useFormsHint'),
          isSwitch: false,
          type: 'checkbox',
          label: t('settings.repositories.useForForms'),
          // the column : its short name, as on the Usage step
          columnLabel: t('settings.repositories.useFormsShort'),
          help: t('settings.repositories.helpUseForForms'),
          hidden: true,
        },
        {
          key: 'use_for_playbooks',
          step: 'usage',
          // the app uses one repository for it
          oneOnly: true,
          shortLabel: t('settings.repositories.usePlaybooksShort'),
          shortHint: t('settings.repositories.usePlaybooksHint'),
          isSwitch: false,
          type: 'checkbox',
          label: t('settings.repositories.useForPlaybooks'),
          // the column : its short name, as on the Usage step
          columnLabel: t('settings.repositories.usePlaybooksShort'),
          help: t('settings.repositories.helpUseForPlaybooks'),
          hidden: true,
        },
        {
          key: 'use_for_inventories',
          step: 'usage',
          // several repositories may hold inventories, each its own
          shortLabel: t('settings.repositories.useInventoriesShort'),
          shortHint: t('settings.repositories.useInventoriesHint'),
          isSwitch: false,
          type: 'checkbox',
          label: t('settings.repositories.useForInventories'),
          // the column : its short name, as on the Usage step
          columnLabel: t('settings.repositories.useInventoriesShort'),
          help: t('settings.repositories.helpUseForInventories'),
          hidden: true,
        },
        {
          key: 'use_for_workflows',
          step: 'usage',
          // several repositories may hold workflows, as forms
          shortLabel: t('settings.repositories.useWorkflowsShort'),
          shortHint: t('settings.repositories.useWorkflowsHint'),
          isSwitch: false,
          type: 'checkbox',
          label: t('settings.repositories.useForWorkflows'),
          // the column : its short name, as on the Usage step
          columnLabel: t('settings.repositories.useWorkflowsShort'),
          help: t('settings.repositories.helpUseForWorkflows'),
          hidden: true,
        },
      ],
    },
    oauth2_providers: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.oauth2'),
      type: 'oauth2',
      route: 'oauth2',
      label: t('settings.oauth2.label'),
      labelPlural: t('settings.oauth2.labelPlural'),
      description: t('settings.oauth2.description'),
      icon: 'right-to-bracket',
      selectable: false,
      // a provider has its own page (pages/admin/sso-provider.vue) : its row and Edit open it, Add the wizard
      openPage: (item) => `/settings/sso/${item.id}`,
      // the dialog in steps, as its page's tabs : its details, its type, as whom and where it signs
      // in (a credential of its type : the app registration, its redirect URL too), its groups. The help a provider
      // needs (the permissions of an Entra ID app, what Open ID was tested with) is in the step it
      // is for
      steps: [
        { key: 'provider', label: t('settings.common.tabDetails') },
        {
          key: 'type',
          label: t('settings.oauth2.stepType'),
          notes: (item) => [item.provider === 'oidc' && { text: t('admin.oauth2.openIdTestedWith') }],
        },
        {
          // as whom and where : a credential of its type (an entraid one with its tenant, an oidc
          // one with its issuer) ; the permissions the Entra ID app needs
          key: 'credentials',
          label: t('settings.common.tabCredentials'),
          notes: (item) => [
            item.provider === 'azuread' && {
              title: t('admin.oauth2.requiredPermissions'),
              items: [t('admin.oauth2.delegatedUserRead'), t('admin.oauth2.delegatedGroupRead')],
            },
          ],
        },
        {
          key: 'groups',
          label: t('settings.oauth2.stepGroups'),
          notes: (item) => [
            item.provider === 'azuread' && {
              title: t('admin.oauth2.groupMembership'),
              items: [t('admin.oauth2.groupsFromGraph'), t('admin.oauth2.groupsRoleMapping')],
            },
          ],
        },
      ],
      actions: [
        { name: 'edit', title: t('settings.oauth2.editProvider'), icon: 'pencil', color: 'edit' },
        // the one its type signs in with : the others of its type stop being it (oauth2.model)
        {
          name: 'use',
          title: t('settings.oauth2.useForSignIn'),
          icon: 'right-to-bracket',
          color: 'edit',
          dividerBefore: true,
          enabledWhen: (p) => !p.enable,
          update: (p) => ({ enable: 1, provider: p.provider }),
        },
        { name: 'delete', title: t('settings.oauth2.deleteProvider'), icon: 'trash', color: 'delete' },
      ],
      fields: [
        // the provider its type's login button signs in with (one per type) : a yes / no column,
        // not in the dialog ; a new one is it when its type has none, another is chosen with Use for
        // sign-in
        {
          key: 'enable',
          label: t('settings.oauth2.active'),
          type: 'checkbox',
          noInput: true,
        },
        { key: 'name', label: t('settings.fields.name'), required: true, icon: 'heading' },
        {
          // its type : radios, each its label and a few words ; set when it is made, it stays
          key: 'provider',
          step: 'type',
          label: t('settings.oauth2.provider'),
          // in the table : Type, as every list's
          columnLabel: t('settings.oauth2.stepType'),
          type: 'radio',
          required: true,
          options: SSO_TYPES.map((value) => ({
            value,
            label: t(`settings.oauth2.type_${value}`),
            hint: t(`settings.oauth2.typeHint_${value}`),
          })),
          initial: (r) => r?.provider || 'azuread',
          render: (v) => esc(t(`settings.oauth2.type_${SSO_TYPES.includes(v) ? v : 'oidc'}`)),
        },
        { key: 'description', label: t('settings.fields.description'), required: false, icon: 'info-circle' },
        {
          // in its credential now (an entraid one) ; kept on the record for the providers that still
          // have one
          key: 'tenant_id',
          noInput: true,
          hidden: true,
          noTable: true,
        },
        {
          // in its credential now ; kept on the record for the providers that still have one
          key: 'client_id',
          noInput: true,
          hidden: true,
          noTable: true,
        },
        {
          // in its credential now (an oidc one) ; kept on the record for the providers that still
          // have one
          key: 'issuer',
          noInput: true,
          hidden: true,
          noTable: true,
        },
        {
          // in its credential now ; kept on the record for the providers that still have one
          key: 'client_secret',
          noInput: true,
          hidden: true,
          noTable: true,
        },
        {
          // an sso credential of Connections > Credentials instead : its user the client id, its
          // password the client secret (which can then come from a secret store)
          key: 'credential',
          step: 'credentials',
          label: t('settings.oauth2.credential'),
          help: t('settings.oauth2.credentialHelp'),
          required: true,
          type: 'select',
          icon: 'key',
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          // the credentials of its type : an Entra ID provider's entraid ones, an Open ID one's oidc
          choicesWhen: (c, item) =>
            !c?.name || c.credential_type === (item.provider === 'azuread' ? 'entraid' : 'oidc'),
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          createDefaults: (item) => ({ credential_type: item.provider === 'azuread' ? 'entraid' : 'oidc' }),
          dependency: 'provider',
          dependencyValues: ['azuread', 'oidc'],
          hidden: true,
          noTable: true,
        },
        {
          // in its credential now (its redirect URL) ; kept on the record for the providers that
          // still have one
          key: 'redirect_uri',
          noInput: true,
          hidden: true,
          noTable: true,
        },
        {
          key: 'groupfilter',
          step: 'groups',
          label: t('settings.oauth2.groupFilter'),
          required: false,
          icon: 'filter',
          hidden: true,
        },
        {
          key: 'scope',
          step: 'provider',
          label: t('settings.oauth2.scope'),
          required: false,
          icon: 'list',
          dependency: 'provider',
          dependencyValues: [''],
          hidden: true,
        },
        {
          key: 'auth_url',
          step: 'provider',
          label: t('settings.oauth2.authUrl'),
          required: false,
          icon: 'globe',
          dependency: 'provider',
          dependencyValues: [''],
          hidden: true,
        },
        {
          key: 'token_url',
          step: 'provider',
          label: t('settings.oauth2.tokenUrl'),
          required: false,
          icon: 'globe',
          dependency: 'provider',
          dependencyValues: [''],
          hidden: true,
        },
        {
          key: 'userinfo_url',
          step: 'provider',
          label: t('settings.oauth2.userinfoUrl'),
          required: false,
          icon: 'globe',
          dependency: 'provider',
          dependencyValues: [''],
          hidden: true,
        },
        {
          key: 'extra',
          step: 'provider',
          label: t('settings.oauth2.extra'),
          type: 'textarea',
          required: false,
          icon: 'code',
          dependency: 'provider',
          dependencyValues: [''],
          hidden: true,
        },
      ],
    },
    schedules: {
      type: 'schedule',
      label: t('settings.schedules.label'),
      labelPlural: t('settings.schedules.labelPlural'),
      // the page's title : the jobs menu's entry (a job state, as the jobs list's titles)
      pageTitle: t('jobs.menu.scheduled'),
      description: t('settings.schedules.description'),
      // reloadSeconds: 7,
      icon: 'clock',
      selectable: false,
      // a schedule has its own page (pages/schedule.vue) : its row and Edit open it, New the
      // wizard
      openPage: (item) => `/jobs/scheduled/${item.id}`,
      // the dialog in steps : what runs (its name, the form), when (once at a time, or on a cron
      // schedule), the extra vars it sends to the form
      steps: [
        // as its page's tabs : Details, then Schedule (once at a time, or a cron)
        { key: 'schedule', label: t('settings.common.tabDetails') },
        { key: 'when', label: t('settings.schedules.stepSchedule') },
        { key: 'extra-vars', label: t('settings.schedules.stepExtraVars') },
      ],
      actions: [
        // in the row menu, as every list's : editing, running it now, then Delete last, each
        // apart
        { name: 'edit', icon: 'pencil', title: t('settings.schedules.editSchedule'), color: 'edit' },
        {
          name: 'trigger',
          icon: 'play',
          title: t('settings.schedules.runSchedule'),
          color: 'refresh',
          dividerBefore: true,
        },
        { name: 'delete', icon: 'trash', title: t('settings.schedules.deleteSchedule'), color: 'delete' },
      ],
      // the short columns as wide as their headers, a date as wide as its text, the name and
      // the form share the rest
      fields: [
        { key: 'id', hidden: true, noInput: true },
        { key: 'output', hidden: true, noInput: true },
        {
          key: 'name',
          icon: 'heading',
          label: t('settings.fields.name'),
          placeholder: t('settings.schedules.placeholderName'),
          readonly: false,
          required: true,
          help: t('settings.repositories.helpName'),
        },
        {
          // the form it runs
          key: 'form',
          icon: 'pen-to-square',
          label: t('settings.fields.form'),
          type: 'select',
          parent: 'formnames',
          values: 'config/formnames',
          valueKey: 'name',
          labelKey: 'name',
          readonly: false,
          required: true,
        },
        {
          key: 'one_time_run',
          step: 'when',
          label: t('settings.schedules.oneTimeRun'),
          type: 'checkbox',
          placeholder: t('settings.schedules.oneTimeRunPlaceholder'),
          required: false,
          hidden: true,
        },
        {
          key: 'cron',
          // the column : how it runs, its cron or once ; the dialog keeps the full title
          columnLabel: t('settings.schedules.stepSchedule'),
          step: 'when',
          icon: 'stopwatch',
          label: t('settings.fields.schedule'),
          type: 'cron',
          // a recurring schedule needs its cron ; hidden (one time run), it is not checked
          required: true,
          // in the table : hovering the cron says it in words, in the app's language ; a one-time
          // run has none, it runs once
          render: (v, row) => (row?.one_time_run ? escapeHtml(t('settings.schedules.oneTimeRun')) : cronCell(v)),
          validator: cronValidator(t),
          negateDependency: true,
          dependency: 'one_time_run',
        },
        {
          key: 'run_at',
          step: 'when',
          icon: 'calendar',
          label: t('settings.schedules.runAt'),
          type: 'datetime',
          convertToUtc: true,
          help: t('settings.schedules.runAtHelp'),
          // in the table, Next run says it (and a cron schedule's next run too) : this column is
          // there to pick in Columns
          hidden: true,
          render: (v) => (v ? Helpers.formatServerDate(v) : '–'),
          // a one time run needs its time ; hidden (a cron schedule), it is not checked
          required: true,
          dependency: 'one_time_run',
        },
        // when it last ran, then when it runs next
        {
          key: 'last_run',
          // left out on a narrow table, so the name and the form keep their room (Next run says
          // more ; the Columns menu still shows it)
          hideBelow: 1200,
          label: t('settings.fields.lastRun'),
          type: 'datetime',
          noInput: true,
          render: (v) => (v ? Helpers.formatServerDate(v) : '–'),
        },
        // when it runs next : its cron's next occurrence, or its one time run while ahead (the
        // server computes it, schedule.model.js)
        {
          key: 'next_run',
          // a date with its time and zone, in full
          label: t('settings.schedules.nextRun'),
          type: 'datetime',
          noInput: true,
          render: (v) => (v ? Helpers.formatServerDate(v) : '–'),
        },
        // none yet (a schedule that never ran) : an en dash rather than an empty cell
        {
          key: 'status',
          label: t('settings.fields.status'),
          noInput: true,
          // the last run's outcome as a pill, as a job's status
          render: (v) => statusPill(t, v),
        },
        // none yet (a schedule that never ran) : an en dash rather than an empty cell
        {
          key: 'state',
          label: t('settings.fields.state'),
          noInput: true,
          // running blue, queued amber, idle grey
          render: (v) => schedulePill(t, v),
        },
        {
          key: 'extra_vars',
          step: 'extra-vars',
          type: 'editor',
          label: t('settings.fields.extraVars'),
          hidden: true,
          lang: 'yaml',
          style: editorStyle('40vh'),
          help: t('settings.schedules.extraVarsHelp'),
        },
      ],
    },
    stored_jobs: {
      type: 'stored-jobs',
      label: t('settings.storedJobs.label'),
      labelPlural: t('settings.storedJobs.labelPlural'),
      // the page's title : the jobs menu's entry (a job state, as the jobs list's titles)
      pageTitle: t('jobs.menu.stored'),
      description: t('settings.storedJobs.description'),
      icon: 'floppy-disk',
      reloadSeconds: false, // Disable auto-reload
      // a row opens its page (its name in the link blue), as every list's ; ticked by its box
      selectable: false,
      // a stored job has its own page (pages/stored-job.vue) : its row and Edit open it ; Add the
      // wizard, as a form's Store button makes one too
      openPage: (item) => `/jobs/stored/${item.id}`,
      // the wizard in steps : what it is and for which form, then the form's values
      steps: [
        { key: 'details', label: t('settings.common.tabDetails') },
        { key: 'values', label: t('settings.storedJobs.tabValues') },
      ],
      // the values are typed as YAML and stored as the JSON the form's Load reads ; no expiry,
      // never
      beforeSave: ({ form_data, never_expires, ...item }) => ({
        ...item,
        form_data: JSON.stringify(YAML.parse(form_data || '') || {}),
        expires_at: never_expires ? null : item.expires_at || null,
      }),
      // in the row menu, as every list's : editing, opening its form with its values, then
      // Delete last, each apart
      actions: [
        { name: 'edit', icon: 'pencil', title: t('settings.storedJobs.editJob'), color: 'edit' },
        {
          name: 'open_form',
          icon: 'play',
          title: t('settings.storedJobs.openInForm'),
          color: 'test',
          dividerBefore: true,
          to: (j) => ({ path: formPath(j.form_name), query: { storedJob: j.id } }),
        },
        { name: 'delete', icon: 'trash', title: t('settings.storedJobs.deleteJob'), color: 'delete' },
      ],
      fields: [
        { key: 'id', hidden: true, noInput: true },
        { key: 'name', step: 'details', icon: 'heading', label: t('settings.fields.name'), required: true },
        // on the page, not a column : it squeezed the name and the form (still in Columns)
        {
          key: 'description',
          step: 'details',
          icon: 'info-circle',
          label: t('settings.fields.description'),
          hidden: true,
        },
        {
          // the form its values are for : chosen once, here ; its page shows it greyed out
          key: 'form_name',
          step: 'details',
          icon: 'pen-to-square',
          label: t('settings.fields.form'),
          type: 'select',
          parent: 'formnames',
          values: 'config/formnames',
          valueKey: 'name',
          labelKey: 'name',
          required: true,
        },
        // whose it is : titled User, as on its page
        {
          key: 'username',
          // the user who stores it : the server's to set
          noInput: true,
          icon: 'user',
          label: t('settings.storedJobs.userTypeName'),
          columnLabel: t('settings.storedJobs.owner'),
        },
        {
          // the form's values, as YAML : a map of field names and values
          key: 'form_data',
          step: 'values',
          type: 'editor',
          lang: 'yaml',
          label: t('settings.storedJobs.tabValues'),
          help: t('settings.storedJobs.valuesHelpNew'),
          style: editorStyle('30vh'),
          hidden: true,
          noTable: true,
          validator: (v) => {
            const parsed = YAML.parse(v || '');
            return parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))
              ? t('settings.storedJobs.valuesNotMap')
              : '';
          },
        },
        {
          key: 'created_at',
          // set by the database
          noInput: true,
          icon: 'calendar',
          label: t('settings.fields.createdAt'),
          type: 'datetime',
          // in the user's zone, with its name : the raw value is a UTC ISO string
          render: (v) => Helpers.formatServerDate(v),
        },
        {
          // never expires, or a date (not stored : expires_at is, none for never) ; on for a new one
          key: 'never_expires',
          step: 'details',
          type: 'checkbox',
          flush: true,
          label: t('settings.storedJobs.neverExpires'),
          initial: (r) => !r?.expires_at,
          hidden: true,
          noTable: true,
        },
        {
          key: 'expires_at',
          step: 'details',
          // only when it expires, and then needed
          dependency: 'never_expires',
          negateDependency: true,
          required: true,
          convertToUtc: true,
          icon: 'calendar',
          label: t('settings.fields.expiresAt'),
          type: 'datetime',
          // in the user's zone, with its name : the raw value is a UTC ISO string ; none, never
          render: (v) => (v ? Helpers.formatServerDate(v) : escapeHtml(t('admin.storedJobs.never'))),
        },
      ],
    },
    knownhosts: {
      type: 'knownhosts',
      label: t('settings.knownhosts.label'),
      description: t('settings.knownhosts.description'),
      removeDoubles: true, // remove double entries
      flat: true, // flat data structure,
      icon: 'server',
      actions: [
        { name: 'preview', title: t('settings.knownhosts.showEntry'), icon: 'copy', color: 'change' },
        { name: 'delete', title: t('settings.knownhosts.deleteEntry'), icon: 'trash', color: 'delete' },
      ],
      fields: [
        { key: 'id', label: t('settings.knownhosts.hostEntry'), filterable: true, hidden: true, noInput: true },
        { key: 'name', label: t('settings.knownhosts.hostEntry'), required: false, filterable: true, noInput: true },
        { key: 'host', label: t('settings.fields.host'), required: true, filterable: true, hidden: true },
      ],
    },
    credentials: {
      type: 'credential',
      label: t('settings.credentials.label'),
      description: t('settings.credentials.description'),
      icon: 'lock',
      selectable: false,
      // the dialog in steps : what the credential is, what it is for, its login (where an ssh or
      // a database one connects, its user and password ; git and an api have their address where
      // they are used), where the user and password are kept
      steps: [
        { key: 'credential', label: t('settings.credentials.stepCredential') },
        { key: 'type', label: t('settings.credentials.stepType') },
        { key: 'login', label: t('settings.credentials.stepLogin') },
        {
          // a cyberark credential is how a CyberArk store logs in : never read from a store
          key: 'store',
          label: t('settings.credentials.stepStore'),
          when: (item) => item.credential_type !== 'cyberark',
        },
      ],
      // where the user and password are kept is not stored : a secret store (then the user and
      // password typed are not kept) or MySQL, the app's database (then no secret store)
      beforeSave: ({ secret_source, ...item }) => {
        if (secret_source === 'store' && item.credential_type !== 'cyberark') {
          delete item.user;
          delete item.password;
          return item;
        }
        return { ...item, secret_store: '', secret_ref: '' };
      },
      // a credential has its own page (pages/admin/credential.vue) : its row and Edit open it, New
      // the wizard
      openPage: (item) => `/settings/credentials/${item.id}`,
      // in the row menu, as the runners' : editing, the test (a database's), then Delete last, each
      // apart (its password is changed on its page)
      actions: [
        { name: 'edit', title: t('settings.credentials.editCredential'), icon: 'pencil', color: 'edit' },
        {
          name: 'test',
          title: t('settings.common.testConnection'),
          icon: 'plug',
          color: 'test',
          dependency: 'is_database',
          dividerBefore: true,
        },
        { name: 'delete', title: t('settings.credentials.deleteCredential'), icon: 'trash', color: 'delete' },
      ],
      fields: [
        {
          key: 'id',
          label: t('settings.fields.id'),
          sortable: false,
          required: false,
          filterable: false,
          noInput: true,
          hidden: true,
          icon: 'key',
        },
        {
          // where the user and password are kept : MySQL (the app's database, encrypted) or a
          // secret store (not stored, read from the record ; beforeSave clears the other side)
          key: 'secret_source',
          step: 'store',
          label: t('settings.credentials.stepStore'),
          type: 'radio',
          options: [
            {
              value: 'local',
              label: t('settings.credentials.secretLocal'),
              hint: t('settings.credentials.secretLocalHint'),
            },
            {
              value: 'store',
              label: t('settings.credentials.secretFromStore'),
              hint: t('settings.credentials.secretFromStoreHint'),
            },
          ],
          initial: (r) => (r?.secret_store ? 'store' : 'local'),
          hidden: true,
          noTable: true,
        },
        {
          key: 'name',
          label: t('settings.fields.name'),
          sortable: true,
          required: true,
          filterable: true,
          icon: 'lock',
          isKey: true,
        },
        {
          // what it is for : radio buttons ; a host for ssh or a database, its type and name for
          // a database
          key: 'credential_type',
          step: 'type',
          label: t('settings.credentials.type'),
          type: 'radio',
          options: CREDENTIAL_TYPES.map((value) => ({
            value,
            label: t(`settings.credentials.type_${value}`),
            hint: t(`settings.credentials.type_${value}Hint`),
          })),
          // a type the record does not have (none yet, an unknown one) : from its is_database flag
          initial: (r) =>
            CREDENTIAL_TYPES.includes(r?.credential_type)
              ? r.credential_type
              : r?.id && r?.is_database
                ? 'database'
                : 'userpass',
          render: (v, r) =>
            escapeHtml(
              t(
                `settings.credentials.type_${CREDENTIAL_TYPES.includes(v) ? v : r?.is_database ? 'database' : 'userpass'}`,
              ),
            ),
          sortable: true,
          filterable: true,
        },
        {
          key: 'description',
          label: t('settings.fields.description'),
          sortable: false,
          required: true,
          filterable: false,
          icon: 'info-circle',
        },
        {
          // how many records use it (the server counts them, as its Used by tab lists them) : a
          // column, to the right
          key: 'used_by_count',
          label: t('settings.linked.usedBy'),
          noInput: true,
          align: 'end',
          filterable: false,
          filterType: 'number',
          // none : an en dash, as the other empty cells
          render: (v) => (v ? String(v) : '–'),
        },
        {
          key: 'db_type',
          step: 'login',
          label: t('settings.credentials.databaseType'),
          type: 'select',
          sortable: false,
          hidden: true,
          required: true,
          parent: 'databases',
          values: [
            { value: 'mysql', label: 'MySQL' },
            { value: 'mssql', label: 'MSSQL' },
            { value: 'postgres', label: 'PostgreSQL' },
            { value: 'oracle', label: 'Oracle' },
            { value: 'mongodb', label: 'MongoDB' },
          ],
          labelKey: 'label',
          valueKey: 'value',
          filterable: true,
          icon: 'database',
          dependency: 'credential_type',
          dependencyValues: ['database'],
        },
        {
          key: 'host',
          step: 'login',
          dependency: 'credential_type',
          dependencyValues: ['ssh', 'database', 'smtp', 'ldap'],
          label: t('settings.fields.host'),
          // an smtp one's host is its mail server, an ldap one's its directory's servers (one per
          // input, tried in order) : both need it
          dialogLabel: (r) =>
            ({ smtp: t('settings.mail.mailServer'), ldap: t('settings.ldap.servers') })[r.credential_type] || null,
          help: (r) =>
            ({ smtp: t('settings.mail.mailServerHelp'), ldap: t('settings.ldap.serversHelp') })[r.credential_type] ||
            null,
          placeholder: (r) => ({ smtp: 'smtp.example.com', ldap: 'dc1.corp.example' })[r.credential_type] || '',
          listWhen: (r) => r.credential_type === 'ldap',
          addLabel: t('settings.ldap.addServer'),
          requiredWhen: (r) => ['smtp', 'ldap'].includes(r.credential_type),
          // no column : most credentials connect to nothing, an ssh, a database or an smtp one
          // shows it on its page
          noTable: true,
          sortable: true,
          required: false,
          filterable: true,
          icon: 'server',
        },
        {
          key: 'port',
          step: 'login',
          dependency: 'credential_type',
          dependencyValues: ['ssh', 'database', 'smtp', 'ldap'],
          label: t('settings.fields.port'),
          dialogLabel: (r) => (r.credential_type === 'smtp' ? t('settings.mail.mailPort') : null),
          help: (r) => (r.credential_type === 'smtp' ? t('settings.mail.mailPortHelp') : null),
          noTable: true,
          type: 'number',
          sortable: true,
          required: false,
          filterable: false,
          icon: 'arrows-alt-v',
        },
        {
          // an smtp or an ldap one : TLS to its servers
          key: 'secure',
          step: 'login',
          dependency: 'credential_type',
          dependencyValues: ['smtp', 'ldap'],
          label: t('settings.mail.useTls'),
          dialogLabel: (r) => (r.credential_type === 'ldap' ? t('settings.ldap.enableTls') : null),
          help: (r) =>
            r.credential_type === 'ldap' ? t('settings.ldap.enableTlsDesc') : t('settings.mail.useTlsHelp'),
          type: 'checkbox',
          noTable: true,
          hidden: true,
          required: false,
          filterable: false,
        },
        {
          key: 'db_name',
          step: 'login',
          label: t('settings.credentials.database'),
          sortable: false,
          hidden: true,
          required: false,
          filterable: false,
          icon: 'database',
          dependency: 'credential_type',
          dependencyValues: ['database'],
        },
        {
          // an oidc credential's issuer : the provider's address, first as an entraid one's tenant
          key: 'issuer',
          step: 'login',
          icon: 'globe',
          label: t('settings.oauth2.issuer'),
          placeholder: 'https://id.example.com/realms/main',
          required: true,
          hidden: true,
          noTable: true,
          dependency: 'credential_type',
          dependencyValues: ['oidc'],
        },
        {
          // an entraid credential's tenant : the tenant id the Entra ID app is in, first
          // as in the Entra admin center (tenant, client id, secret) ; the sign-in needs it
          key: 'tenant_id',
          step: 'login',
          icon: 'building',
          label: t('settings.oauth2.tenantId'),
          required: true,
          hidden: true,
          noTable: true,
          dependency: 'credential_type',
          dependencyValues: ['entraid'],
        },
        {
          key: 'user',
          step: 'login',
          label: t('settings.fields.user'),
          // a cyberark credential's user is its AppID, an ldap one's the bind DN, an entraid or oidc
          // one's the client id
          dialogLabel: (r) =>
            ({
              cyberark: t('settings.secretStores.appId'),
              ldap: t('settings.ldap.bindUserDn'),
              entraid: t('settings.oauth2.clientId'),
              oidc: t('settings.oauth2.clientId'),
            })[r.credential_type] || null,
          help: (r) => (r.credential_type === 'cyberark' ? t('settings.secretStores.appIdHelp') : null),
          // no column : what it is depends on the type (a user, a bind DN, a client id), its page
          // shows it
          noTable: true,
          sortable: true,
          required: false,
          filterable: true,
          icon: 'user',
        },
        {
          key: 'password',
          step: 'login',
          // shown when editing too, as ******** : left empty, the stored one stays
          onEdit: true,
          label: t('settings.fields.password'),
          type: 'password',
          sortable: false,
          required: false,
          filterable: false,
          icon: 'lock',
          hidden: true,
          // an ldap credential's password is the bind password, an entraid or oidc one's the client secret
          dialogLabel: (r) =>
            ({
              ldap: t('settings.ldap.bindUserPassword'),
              entraid: t('settings.oauth2.clientSecret'),
              oidc: t('settings.oauth2.clientSecret'),
            })[r.credential_type] || null,
          // a cyberark credential has a client key instead
          dependency: 'credential_type',
          dependencyValues: ['userpass', 'ssh', 'git', 'api', 'database', 'smtp', 'ldap', 'entraid', 'oidc'],
        },
        {
          // an entraid or oidc credential's redirect URL, as registered with the client : empty,
          // the app's address and the type's callback path (shown as its placeholder)
          key: 'redirect_uri',
          step: 'login',
          icon: 'link',
          label: t('settings.oauth2.redirectUrl'),
          help: t('settings.oauth2.redirectHelp'),
          placeholder: (r, config) =>
            ssoCallbackUrl(r.credential_type, config?.url) || ssoCallbackUrl(r.credential_type, SSO_EXAMPLE_BASE),
          hidden: true,
          noTable: true,
          dependency: 'credential_type',
          dependencyValues: ['entraid', 'oidc'],
        },
        {
          // an ldap one with TLS : its servers' certificates not checked
          key: 'ignore_certs',
          step: 'login',
          label: t('settings.ldap.ignoreCerts'),
          help: t('settings.ldap.ignoreCertsDesc'),
          type: 'checkbox',
          noTable: true,
          hidden: true,
          required: false,
          filterable: false,
          showWhen: (r) => r.credential_type === 'ldap' && !!r.secure,
        },
        {
          // a cyberark credential : the client certificate and key its AppID may be restricted to ;
          // an ldap one with its certificates checked : the client certificate its servers check
          key: 'client_cert',
          step: 'login',
          icon: 'certificate',
          type: 'textarea',
          label: t('settings.secretStores.clientCert'),
          dialogLabel: (r) => (r.credential_type === 'ldap' ? t('settings.fields.certificate') : null),
          help: (r) => (r.credential_type === 'cyberark' ? t('settings.secretStores.clientCertHelp') : null),
          placeholder: '-----BEGIN CERTIFICATE-----',
          hidden: true,
          noTable: true,
          showWhen: (r) =>
            r.credential_type === 'cyberark' || (r.credential_type === 'ldap' && !!r.secure && !r.ignore_certs),
        },
        {
          // an ldap one with its certificates checked : the CA bundle they are checked against
          key: 'ca_bundle',
          step: 'login',
          icon: 'certificate',
          type: 'textarea',
          label: t('settings.fields.caBundle'),
          placeholder: '-----BEGIN CERTIFICATE-----',
          hidden: true,
          noTable: true,
          showWhen: (r) => r.credential_type === 'ldap' && !!r.secure && !r.ignore_certs,
        },
        {
          key: 'client_key',
          step: 'login',
          icon: 'key',
          type: 'textarea',
          label: t('settings.secretStores.clientKey'),
          help: (r) => (r.id ? t('settings.credentials.clientKeyKeep') : t('settings.secretStores.clientKeyHelp')),
          placeholder: '-----BEGIN PRIVATE KEY-----',
          hidden: true,
          noTable: true,
          // shown empty : the stored key is never sent back ; left empty, it stays
          initial: () => '',
          dependency: 'credential_type',
          dependencyValues: ['cyberark'],
        },
        {
          key: 'secret_store',
          step: 'store',
          // none yet : only a New secret store button
          createWith: 'secretStores',
          createLabel: t('settings.credentials.newSecretStore'),
          dependency: 'secret_source',
          dependencyValues: ['store'],
          label: t('settings.credentials.secretStore'),
          help: t('settings.credentials.secretStoreHelp'),
          type: 'select',
          parent: 'secretstores',
          values: 'secretstore',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          sortable: false,
          required: false,
          filterable: false,
          icon: 'vault',
          hidden: true,
        },
        {
          key: 'secret_ref',
          // no secret store yet : nothing to refer to
          needsChoicesOf: 'secret_store',
          label: t('settings.credentials.secretRef'),
          placeholder: t('settings.credentials.secretRefPlaceholder'),
          help: t('settings.credentials.secretRefHelp'),
          sortable: false,
          required: false,
          filterable: false,
          icon: 'shield-alt',
          hidden: true,
          step: 'store',
          dependency: 'secret_source',
          dependencyValues: ['store'],
        },
      ],
    },
    ssh: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.ssh'),
      label: t('settings.ssh.label'),
      description: t('settings.ssh.description'),
      type: 'sshkey',
      icon: 'key',
      fields: [
        { key: 'art', label: t('settings.ssh.privateKeyArt'), type: 'sshPrivateKeyArt', line: 0 },
        {
          key: 'key',
          label: t('settings.ssh.privateKey'),
          help: t('settings.ssh.privateKeyHelp'),
          type: 'textarea',
          placeholder: '-----BEGIN RSA PRIVATE KEY-----',
          line: 1,
          required: true,
        },
        {
          key: 'publicKey',
          label: t('settings.ssh.publicKey'),
          help: t('settings.ssh.publicKeyHelp'),
          type: 'sshPublicKey',
          line: 2,
        },
      ],
    },
    ldap: {
      type: 'ldap',
      // Show every field even when LDAP is off, greyed rather than hidden: an admin
      // deciding whether to enable it needs to see what it will ask for.
      showDisabledFields: true,
      label: t('settings.ldap.label'),
      description: t('settings.ldap.description'),
      icon: 'address-book',
      // Enabled under the name, as an SSO provider's Active
      togglesLast: true,
      // the tabs of long values (search bases, DNs, attributes) : their fields wider
      wideTabs: ['users', 'groups'],
      // a directory's page (pages/admin/ldap-directory.vue) : its test, and Delete but on the default
      // one, which is turned off instead
      actions: [
        { name: 'test', title: t('settings.common.testConnection'), icon: 'plug', dependency: 'enable' },
        { name: 'delete', title: t('common.delete'), icon: 'trash', showWhen: (item) => item.name !== 'default' },
      ],
      fields: [
        {
          key: 'enable',
          tab: 'general',
          label: t('settings.ldap.enabled'),
          help: t('settings.ldap.enableLdapHelp'),
          type: 'checkbox',
          isToggle: true,
        },
        // the directory : its name prefixes its members (but the default one's) ; its place in the
        // lookup order is its place in the list (Move up, Move down)
        {
          key: 'name',
          tab: 'general',
          icon: 'tag',
          line: 0,
          label: t('settings.fields.name'),
          help: t('settings.ldap.nameHelp'),
          placeholder: 'corp',
          required: true,
          disabledWhen: (item, saved) => saved.name === 'default',
        },
        {
          // what it is, for the list and its page
          key: 'description',
          tab: 'general',
          icon: 'info-circle',
          line: 1,
          label: t('settings.fields.description'),
        },
        {
          key: 'search_base',
          tab: 'users',
          icon: 'search',
          line: 100,
          label: t('settings.ldap.searchBase'),
          help: t('settings.ldap.searchBaseDesc'),
          required: true,
          dependency: 'enable',
        },
        {
          key: 'mail_attribute',
          tab: 'users',
          icon: 'envelope',
          line: 102,
          label: t('settings.ldap.mailAttribute'),
          help: t('settings.ldap.mailAttributeDesc'),
          required: true,
          dependency: 'enable',
        },
        {
          // where it connects and as whom : an ldap credential of Connections > Credentials (its
          // servers, port, TLS and certificates, and the bind DN and password)
          key: 'credential',
          tab: 'credentials',
          icon: 'key',
          line: 50,
          type: 'select',
          label: t('settings.ldap.credential'),
          help: t('settings.ldap.credentialHelp'),
          // its page's dropdown (AppAdminSingle) and the New dialog's (AppAdminMulti) : the ldap
          // credentials only
          valuesFrom: { url: '/api/v2/credential/', filter: (c) => c.credential_type === 'ldap' },
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          choicesWhen: (c) => !c?.name || c.credential_type === 'ldap',
          // the New dialog's : a new ldap credential
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          createDefaults: { credential_type: 'ldap' },
          required: true,
          dependency: 'enable',
        },
        {
          key: 'domains',
          tab: 'users',
          icon: 'at',
          // one per input, stored comma separated
          type: 'list',
          addLabel: t('settings.ldap.addDomain'),
          line: 103,
          label: t('settings.ldap.domains'),
          help: t('settings.ldap.domainsHelp'),
          placeholder: 'corp.example',
          dependency: 'enable',
        },
        {
          key: 'username_attribute',
          tab: 'users',
          icon: 'image-portrait',
          line: 101,
          label: t('settings.ldap.usernameAttribute'),
          help: t('settings.ldap.usernameAttributeDesc'),
          required: true,
          dependency: 'enable',
        },
        {
          key: 'groups_attribute',
          tab: 'groups',
          icon: 'users',
          line: 13,
          label: t('settings.ldap.groupsAttribute'),
          help: t('settings.ldap.groupsAttributeDesc'),
          required: true,
          dependency: 'enable',
        },
        {
          key: 'groups_search_base',
          tab: 'groups',
          icon: 'users-viewfinder',
          line: 14,
          label: t('settings.ldap.groupsSearchBase'),
          help: t('settings.ldap.groupsSearchBaseDesc'),
          required: false,
          dependency: 'enable',
        },
        {
          key: 'group_class',
          tab: 'groups',
          icon: 'users-rectangle',
          line: 15,
          label: t('settings.ldap.groupClass'),
          help: t('settings.ldap.groupClassDesc'),
          required: false,
          dependency: 'enable',
        },
        {
          key: 'group_member_attribute',
          tab: 'groups',
          icon: 'users-line',
          line: 16,
          label: t('settings.ldap.groupMemberAttribute'),
          help: t('settings.ldap.groupMemberAttributeDesc'),
          required: false,
          dependency: 'enable',
        },
        {
          key: 'group_member_user_attribute',
          tab: 'groups',
          icon: 'user-group',
          line: 17,
          label: t('settings.ldap.groupMemberUserAttribute'),
          help: t('settings.ldap.groupMemberUserAttributeDesc'),
          required: false,
          dependency: 'enable',
        },
        {
          key: 'groupfilter',
          tab: 'groups',
          icon: 'filter',
          line: 18,
          label: t('settings.ldap.groupFilter'),
          help: t('settings.ldap.groupFilterDesc'),
          required: false,
          dependency: 'enable',
        },
      ],
    },
    chat: {
      // the chat assistant's model provider ; the api key never comes back from the server
      type: 'chatsettings',
      showDisabledFields: true,
      label: t('settings.chat.label'),
      description: t('settings.chat.description'),
      icon: 'comments',
      actions: [{ name: 'test', title: t('settings.common.testConnection'), icon: 'plug', dependency: 'provider' }],
      fields: [
        {
          key: 'provider',
          tab: 'model-provider',
          icon: 'robot',
          line: 0,
          type: 'select',
          label: t('settings.chat.provider'),
          help: t('settings.chat.providerHelp'),
          values: [
            { value: '', label: t('settings.chat.providerNone') },
            ...CHAT_PROVIDERS.map((p) => ({ value: p.value, label: p.label || t('settings.chat.providerCustom') })),
          ],
          onChange: (val, item) => {
            const p = CHAT_PROVIDERS.find((x) => x.value === val);
            if (!p) return;
            item.base_url = p.base_url;
            item.auth_type = p.auth_type || '';
            item.api_version = p.api_version || '';
          },
        },
        {
          key: 'model',
          tab: 'model-provider',
          icon: 'microchip',
          line: 1,
          label: t('settings.chat.model'),
          help: t('settings.chat.modelHelp'),
          placeholder: 'claude-sonnet-5-5 / gpt-5 / llama3.3',
          required: true,
          dependency: 'provider',
        },
        {
          key: 'base_url',
          tab: 'model-provider',
          icon: 'link',
          line: 2,
          label: t('settings.chat.baseUrl'),
          help: t('settings.chat.baseUrlHelp'),
          placeholder: 'https://<proxy>/v1',
          dependency: 'provider',
        },
        {
          // the key : the password of an api credential of Connections > Credentials (a key
          // saved before credentials keeps working while none is chosen)
          key: 'credential',
          tab: 'credentials',
          icon: 'key',
          line: 3,
          type: 'select',
          label: t('settings.chat.credential'),
          help: t('settings.chat.credentialHelp'),
          valuesFrom: { url: '/api/v2/credential/', filter: (c) => c.credential_type === 'api' },
          // Add credential under it : a new api credential
          createWith: 'credentials',
          createDefaults: { credential_type: 'api' },
          dependency: 'provider',
        },
        {
          key: 'auth_type',
          tab: 'model-provider',
          icon: 'id-card',
          line: 20,
          type: 'select',
          label: t('settings.chat.authType'),
          help: t('settings.chat.authTypeHelp'),
          dependency: 'provider',
          values: [
            { value: '', label: t('settings.chat.authDefault') },
            { value: 'bearer', label: 'Authorization: Bearer' },
            { value: 'api-key', label: 'api-key' },
            { value: 'x-api-key', label: 'x-api-key' },
            { value: 'none', label: t('settings.chat.authNone') },
          ],
        },
        {
          key: 'api_version',
          tab: 'model-provider',
          icon: 'code-branch',
          line: 5,
          label: t('settings.chat.apiVersion'),
          help: t('settings.chat.apiVersionHelp'),
          placeholder: '2024-10-21',
          dependency: 'provider',
        },
        {
          key: 'request_user',
          tab: 'model-provider',
          icon: 'user',
          line: 6,
          label: t('settings.chat.user'),
          help: t('settings.chat.userHelp'),
          dependency: 'provider',
        },
        {
          key: 'extra_headers',
          tab: 'model-provider',
          icon: 'list',
          line: 7,
          type: 'textarea',
          label: t('settings.chat.extraHeaders'),
          help: t('settings.chat.extraHeadersHelp'),
          placeholder: '{"X-Org": "ops"}',
          dependency: 'provider',
        },
        {
          key: 'max_turns',
          tab: 'limits',
          icon: 'comments',
          line: 8,
          type: 'number',
          label: t('settings.chat.maxTurns'),
          help: t('settings.chat.maxTurnsHelp'),
          dependency: 'provider',
        },
        {
          key: 'max_tool_rounds',
          tab: 'limits',
          icon: 'arrows-rotate',
          line: 9,
          type: 'number',
          label: t('settings.chat.maxToolRounds'),
          help: t('settings.chat.maxToolRoundsHelp'),
          dependency: 'provider',
        },
        {
          key: 'timeout_seconds',
          tab: 'limits',
          icon: 'clock',
          line: 10,
          type: 'number',
          label: t('settings.chat.timeout'),
          help: t('settings.chat.timeoutHelp'),
          dependency: 'provider',
        },
        {
          key: 'ignore_certs',
          tab: 'model-provider',
          line: 11,
          type: 'checkbox',
          label: t('settings.chat.ignoreCerts'),
          help: t('settings.chat.ignoreCertsHelp'),
          dependency: 'provider',
        },
        // a switch with its title and help, as the chat's own switch above it
        {
          key: 'allow_job_status',
          tab: 'general',
          type: 'checkbox',
          isToggle: true,
          label: t('settings.chat.allowJobStatus'),
          help: t('settings.chat.allowJobStatusHelp'),
        },
      ],
    },
    // External secret managers. The types mirror SECRET_STORE_TYPES in
    // server/src/secrets/providers/index.js ; which fields a type shows follows its provider.
    // Where a job runs : an RTE container (this image with AF_ROLE=rte) for playbooks,
    // AWX / AAP / Ascender for templates
    runners: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.runners'),
      type: 'runner',
      label: t('settings.runners.label'),
      description: t('settings.runners.description'),
      icon: 'rocket',
      selectable: false,
      // the defaults, chosen in a dialog (Edit defaults) : one per runner type, where the forms
      // of that type (ansible on an RTE ; awx, aap and ascender on an awx runner ; semaphore,
      // rundeck, jenkins on theirs) run when they name no runner
      defaultPicker: {
        key: 'is_default',
        groupBy: (r) => r?.type || null,
        title: t('settings.runners.defaultsTitle'),
        editLabel: t('settings.runners.editDefaults'),
        groups: ['rte', 'awx', 'semaphore', 'rundeck', 'jenkins'].map((type) => ({
          key: type,
          label: t(`settings.runners.default_${type}`),
          help: t(`settings.runners.default_${type}Help`),
          icon: type === 'rte' ? 'fac,ansible' : 'rocket',
          describe: (r) => t(`settings.runners.kind_${runnerKind(r)}`),
        })),
      },
      // the dialog in steps : what the runner is, its kind, where it is, how the app logs in
      steps: [
        { key: 'runner', label: t('settings.runners.stepRunner') },
        { key: 'type', label: t('settings.runners.stepType') },
        { key: 'credentials', label: t('settings.runners.stepAuth') },
        { key: 'connection', label: t('settings.runners.stepConnection') },
      ],
      // the kind chosen is stored as a type and a flavour : an RTE, or an awx runner that is an
      // AWX, an AAP or an Ascender. What the api adds or the RTE writes (state, node_id) is
      // never sent.
      beforeSave: ({ kind, skip_verify, custom_ca, state: _state, node_id: _nodeId, ...item }) => ({
        ...item,
        // what is stored : the certificate checked or not, and a private authority's certificates
        // only when checked against one
        ignore_certs: !!skip_verify,
        ca_bundle: !skip_verify && custom_ca ? item.ca_bundle || '' : '',
        type: kind === 'rte' || PROJECT_RUNNER_KINDS.includes(kind) ? kind : 'awx',
        flavour: ['aap', 'ascender'].includes(kind) ? kind : null,
        // the project : a Semaphore's, a Rundeck's or a Jenkins' (its folder) only
        project: PROJECT_RUNNER_KINDS.includes(kind) ? String(item.project || '').trim() : null,
      }),
      // a runner has its own page (pages/admin/runner.vue) : its row and Edit open it, New the wizard
      openPage: (item) => `/settings/runners/${item.id}`,
      // in the row menu : editing, the test, its token or password (on its page), then Delete
      // last, each apart
      actions: [
        { name: 'edit', title: t('settings.runners.editRunner'), icon: 'pencil', color: 'edit' },
        {
          name: 'test',
          title: t('settings.common.testConnection'),
          icon: 'plug',
          color: 'test',
          dividerBefore: true,
        },
        {
          // the credential it signs in with : its page's Credentials tab
          name: 'change_credentials',
          title: t('settings.repositories.changeCredentials'),
          icon: 'key',
          color: 'change',
          dividerBefore: true,
          to: (r) => `/settings/runners/${r.id}/credentials`,
        },
        { name: 'delete', title: t('settings.runners.deleteRunner'), icon: 'trash', color: 'delete' },
      ],
      fields: [
        {
          key: 'id',
          label: t('settings.fields.id'),
          sortable: false,
          required: false,
          filterable: false,
          noInput: true,
          hidden: true,
          icon: 'key',
        },
        {
          key: 'is_default',
          label: t('settings.runners.isDefault'),
          help: t('settings.runners.isDefaultHelp'),
          type: 'checkbox',
          // chosen in the Edit defaults dialog (defaultPicker), not in the runner's : a column only
          noInput: true,
        },
        {
          key: 'name',
          icon: 'heading',
          line: 0,
          label: t('settings.fields.name'),
          required: true,
          filterable: true,
          help: t('settings.runners.nameHelp'),
        },
        {
          // RTE, AWX, AAP or Ascender : one choice, radio buttons (not stored : the type and the
          // flavour are, see beforeSave)
          key: 'kind',
          step: 'type',
          label: t('settings.runners.type'),
          type: 'radio',
          options: RUNNER_KINDS.map((value) => ({
            value,
            label: t(`settings.runners.type_${value}`),
            hint: t(`settings.runners.type_${value}Hint`),
          })),
          initial: runnerKind,
          noTable: true,
        },
        {
          // the list's Type column : the kind's full name
          key: 'type',
          label: t('settings.runners.type'),
          noInput: true,
          filterable: true,
          render: (_, r) => escapeHtml(t(`settings.runners.kind_${runnerKind(r)}`)),
          sortValue: (r) => runnerKind(r),
        },
        {
          key: 'flavour',
          label: t('settings.runners.flavour'),
          noInput: true,
          hidden: true,
          render: (v) => escapeHtml(RUNNER_FLAVOURS.find((x) => x.value === (v || null))?.label || ''),
        },
        {
          key: 'description',
          icon: 'info-circle',
          line: 0,
          label: t('settings.fields.description'),
          required: false,
        },
        // set by the api for a runner its RTE registered itself (rte/register.js) : automatic
        // while the RTE writes its heartbeat, unresponsive once it stopped - the worker removes
        // it after 10 minutes. Any other runner is manual. A column only, never sent (beforeSave). render() output goes to
        // v-html : static markup and a locale string only, as a pill (registrationPill)
        {
          key: 'state',
          label: t('settings.runners.state'),
          noInput: true,
          sortable: true,
          render: (v) => registrationPill(t, v),
        },
        {
          key: 'uri',
          step: 'connection',
          icon: 'globe',
          line: 1,
          label: t('settings.fields.uri'),
          // in Columns : the description shows instead
          hidden: true,
          required: true,
          // the address of the kind chosen
          help: (r) => t(`settings.runners.uriHelp_${r.kind || 'rte'}`),
          placeholder: (r) => RUNNER_URI_EXAMPLE[r.kind] || RUNNER_URI_EXAMPLE.rte,
        },
        {
          // a Semaphore's project id, a Rundeck's project name, a Jenkins' folder
          key: 'project',
          step: 'connection',
          icon: 'folder',
          line: 1,
          label: t('settings.runners.project'),
          required: false,
          hidden: true,
          help: (r) =>
            t(`settings.runners.projectHelp_${PROJECT_RUNNER_KINDS.includes(r.kind) ? r.kind : 'semaphore'}`),
          dependency: 'kind',
          dependencyValues: PROJECT_RUNNER_KINDS,
        },
        {
          // as whom : a credential of Connections > Credentials - an api one (its password the
          // token : an RTE's RTE_TOKEN, a Semaphore's, a Rundeck's, an AWX's API token) or a
          // userpass one (an AWX's user and password, a Jenkins user and its API token)
          key: 'credential',
          step: 'credentials',
          icon: 'key',
          label: t('settings.runners.credential'),
          help: (r) =>
            t(
              `settings.runners.credentialHelp_${r.kind === 'jenkins' ? 'jenkins' : AWX_RUNNER_KINDS.includes(r.kind) ? 'awx' : 'api'}`,
            ),
          type: 'select',
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          required: true,
          // the credentials of the kinds it signs in with
          choicesWhen: (c, item) =>
            !c?.name ||
            (item.kind === 'jenkins'
              ? ['userpass']
              : AWX_RUNNER_KINDS.includes(item.kind)
                ? ['api', 'userpass']
                : ['api']
            ).includes(c.credential_type),
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          createDefaults: (item) => ({ credential_type: item.kind === 'jenkins' ? 'userpass' : 'api' }),
          hidden: true,
          noTable: true,
        },
        {
          // the certificate not checked at all : off by default (not stored : ignore_certs is)
          key: 'skip_verify',
          step: 'connection',
          line: 2,
          type: 'checkbox',
          label: t('settings.runners.skipVerify'),
          initial: (r) => !!r?.ignore_certs,
          noTable: true,
        },
        {
          // checked against a private authority : its certificates below (not stored : a CA
          // bundle is, see beforeSave) ; nothing to check against when not checking
          key: 'custom_ca',
          step: 'connection',
          line: 2,
          type: 'checkbox',
          label: t('settings.runners.customCa'),
          initial: (r) => !!String(r?.ca_bundle || '').trim(),
          noTable: true,
          dependency: 'skip_verify',
          negateDependency: true,
          // skipping the verification turns it off : its CA bundle goes with it
          defaultMap: { true: false },
        },
        {
          // a column only : the dialog asks skip_verify
          key: 'ignore_certs',
          label: t('settings.ldap.ignoreCerts'),
          type: 'checkbox',
          noInput: true,
          hidden: true,
        },
        {
          key: 'ca_bundle',
          step: 'connection',
          icon: 'certificate',
          type: 'textarea',
          line: 3,
          label: t('settings.fields.caBundle'),
          required: false,
          // a private authority : the certificates the runner's is checked against
          help: t('settings.runners.caBundleHelp'),
          dependency: 'custom_ca',
          placeholder: '-----BEGIN CERTIFICATE-----',
          hidden: true,
        },
      ],
    },
    notificationChannels: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.notifications'),
      type: 'notificationchannel',
      label: t('settings.notificationChannels.label'),
      labelPlural: t('settings.notificationChannels.labelPlural'),
      description: t('settings.notificationChannels.description'),
      icon: 'bell',
      selectable: false,
      // a channel has its own page (pages/admin/notification-channel.vue) : its row and Edit open
      // it, Add the wizard
      openPage: (item) => `/settings/notifications/${item.id}`,
      // the dialog in steps : the channel, its type, then its type's own (one at a time : a step's
      // when follows the type chosen)
      steps: [
        { key: 'channel', label: t('settings.notificationChannels.stepChannel') },
        { key: 'type', label: t('settings.notificationChannels.stepType') },
        // its credential first, as on every page : mail's smtp one (the mail server, its port and
        // TLS, the login), a Telegram bot's or a webhook's token ; then mail's from address
        {
          key: 'credentials',
          label: t('settings.common.tabCredentials'),
          when: (i) => ['mail', 'telegram', 'webhook'].includes(channelType(i)),
        },
        { key: 'sender', label: t('settings.notificationChannels.stepSender'), when: (i) => channelType(i) === 'mail' },
        {
          key: 'connection',
          label: t('settings.notificationChannels.stepWebhook'),
          when: (i) => ['slack', 'teams'].includes(channelType(i)),
        },
        {
          key: 'connection',
          label: t('settings.notificationChannels.stepBot'),
          when: (i) => channelType(i) === 'telegram',
        },
        {
          key: 'connection',
          label: t('settings.notificationChannels.stepEndpoint'),
          when: (i) => channelType(i) === 'webhook',
        },
        {
          key: 'payload',
          label: t('settings.notificationChannels.stepPayload'),
          when: (i) => channelType(i) === 'webhook',
        },
      ],
      // in the row menu : editing, turning it on or off, for mail making it the active one, a test
      // (on its page, its dialog open), then Delete last, each apart
      actions: [
        { name: 'edit', title: t('settings.notificationChannels.editChannel'), icon: 'pencil', color: 'edit' },
        {
          name: 'enable',
          title: t('settings.notificationChannels.enable'),
          icon: 'toggle-on',
          color: 'edit',
          dividerBefore: true,
          // only the one that changes it : Enable on a channel turned off, Disable on one turned on
          shownWhen: (m) => !m.enabled,
          update: () => ({ enabled: 1 }),
        },
        {
          name: 'disable',
          title: t('settings.notificationChannels.disable'),
          icon: 'toggle-off',
          color: 'edit',
          dividerBefore: true,
          shownWhen: (m) => !!m.enabled,
          update: () => ({ enabled: 0 }),
        },
        {
          // a mail channel only : the one the app sends its mail with ; the others stop being it
          name: 'use',
          title: t('settings.notificationChannels.useForMail'),
          icon: 'envelope',
          color: 'edit',
          shownWhen: (m) => m.type === 'mail',
          enabledWhen: (m) => !m.is_active,
          update: () => ({ is_active: 1 }),
        },
        {
          name: 'send_test',
          title: t('settings.notificationChannels.sendTest'),
          icon: 'paper-plane',
          color: 'test',
          dividerBefore: true,
          to: (m) => ({ path: `/settings/notifications/${m.id}`, query: { test: '1' } }),
        },
        {
          name: 'delete',
          title: t('settings.notificationChannels.deleteChannel'),
          icon: 'trash',
          color: 'delete',
        },
      ],
      fields: [
        { key: 'id', hidden: true, noInput: true, noTable: true },
        {
          // a mail channel the app sends its mail with : a yes / no column ; the first column, before Enabled
          key: 'is_active',
          label: t('settings.notificationChannels.active'),
          type: 'checkbox',
          noInput: true,
          hideBelow: 900,
        },
        {
          // sending or not : a yes / no column ; a new channel is on, the row menu turns it on or off
          key: 'enabled',
          label: t('settings.notificationChannels.enabled'),
          type: 'checkbox',
          noInput: true,
        },
        { key: 'name', step: 'channel', label: t('settings.fields.name'), required: true, icon: 'heading' },
        {
          // its type : radios, each its label and a few words ; set when it is made, it stays
          key: 'type',
          step: 'type',
          label: t('settings.notificationChannels.type'),
          type: 'radio',
          required: true,
          options: CHANNEL_TYPES.map((value) => ({
            value,
            label: t(`settings.notificationChannels.type_${value}`),
            hint: t(`settings.notificationChannels.typeHint_${value}`),
          })),
          initial: (r) => r?.type || 'mail',
          render: (v) => esc(t(`settings.notificationChannels.type_${CHANNEL_TYPES.includes(v) ? v : 'mail'}`)),
        },
        {
          // what it is for : a column after the type
          key: 'description',
          step: 'channel',
          label: t('settings.fields.description'),
          icon: 'info-circle',
        },
        // ─── mail ───
        {
          key: 'from_address',
          step: 'sender',
          type: 'email',
          label: t('settings.mail.mailFrom'),
          help: t('settings.mail.mailFromHelp'),
          placeholder: 'noreply@example.com',
          required: true,
          icon: 'envelope',
          hidden: true,
          showWhen: (i) => channelType(i) === 'mail',
        },
        {
          // where it sends and as whom : an smtp credential of Connections > Credentials (the mail
          // server, its port and TLS, the login ; no user for a relay), or a New one
          key: 'credential',
          step: 'credentials',
          requiredWhen: (i) => channelType(i) === 'mail',
          icon: 'key',
          label: t('settings.notificationChannels.credential'),
          help: t('settings.notificationChannels.helpCredential'),
          type: 'select',
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          createDefaults: { credential_type: 'smtp' },
          // the smtp credentials only
          choicesWhen: (c) => !c?.name || c.credential_type === 'smtp',
          hidden: true,
          showWhen: (i) => channelType(i) === 'mail',
        },
        // ─── slack, teams ───
        {
          // the webhook's address : a secret, never shown again once saved
          key: 'webhook_url',
          step: 'connection',
          type: 'password',
          label: t('settings.notificationChannels.webhookUrl'),
          help: (i) =>
            t(`settings.notificationChannels.webhookUrlHelp_${channelType(i) === 'teams' ? 'teams' : 'slack'}`),
          placeholder: 'https://',
          required: true,
          icon: 'link',
          hidden: true,
          showWhen: (i) => ['slack', 'teams'].includes(channelType(i)),
        },
        // ─── webhook ───
        {
          key: 'url',
          step: 'connection',
          label: t('settings.notificationChannels.url'),
          help: t('settings.notificationChannels.urlHelp'),
          placeholder: 'https://hooks.example.com/ansibleforms',
          required: true,
          icon: 'globe',
          hidden: true,
          showWhen: (i) => channelType(i) === 'webhook',
        },
        {
          key: 'method',
          step: 'connection',
          label: t('settings.notificationChannels.method'),
          icon: 'arrow-right',
          type: 'select',
          parent: 'webhookMethods',
          values: ['POST', 'PUT'].map((value) => ({ value, label: value })),
          valueKey: 'value',
          labelKey: 'label',
          initial: (r) => r?.method || 'POST',
          hidden: true,
          showWhen: (i) => channelType(i) === 'webhook',
        },
        {
          // telegram : its bot token ; webhook : a bearer token - each the password of an api
          // credential of Connections > Credentials, or a New one
          key: 'token_credential',
          step: 'credentials',
          icon: 'key',
          label: t('settings.notificationChannels.tokenCredential_webhook'),
          dialogLabel: (i) =>
            t(
              `settings.notificationChannels.tokenCredential_${channelType(i) === 'telegram' ? 'telegram' : 'webhook'}`,
            ),
          help: (i) =>
            t(
              `settings.notificationChannels.tokenCredentialHelp_${channelType(i) === 'telegram' ? 'telegram' : 'webhook'}`,
            ),
          type: 'select',
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          createDefaults: { credential_type: 'api' },
          // the api credentials only : a token is their password
          choicesWhen: (c) => !c?.name || c.credential_type === 'api',
          hidden: true,
          showWhen: (i) => ['telegram', 'webhook'].includes(channelType(i)),
        },
        // ─── telegram : its chat, after its bot token ───
        {
          key: 'chat_id',
          step: 'connection',
          label: t('settings.notificationChannels.chatId'),
          help: t('settings.notificationChannels.chatIdHelp'),
          placeholder: '-1001234567890',
          required: true,
          icon: 'comments',
          hidden: true,
          showWhen: (i) => channelType(i) === 'telegram',
        },
        {
          // a Bot API of its own (a local Bot API server) ; empty : api.telegram.org
          key: 'api_url',
          step: 'connection',
          label: t('settings.notificationChannels.apiUrl'),
          help: t('settings.notificationChannels.apiUrlHelp'),
          placeholder: 'https://api.telegram.org',
          icon: 'globe',
          hidden: true,
          showWhen: (i) => channelType(i) === 'telegram',
        },
        {
          key: 'verify_tls',
          step: 'connection',
          type: 'checkbox',
          flush: true,
          label: t('settings.notificationChannels.verifyTls'),
          help: t('settings.notificationChannels.verifyTlsHelp'),
          initial: (r) => (r?.id ? !!r.verify_tls : true),
          hidden: true,
          showWhen: (i) => channelType(i) === 'webhook',
        },
        {
          key: 'headers',
          step: 'payload',
          type: 'textarea',
          rows: 3,
          label: t('settings.notificationChannels.headers'),
          help: t('settings.notificationChannels.headersHelp'),
          placeholder: '{ "X-Source": "ansibleforms" }',
          hidden: true,
          showWhen: (i) => channelType(i) === 'webhook',
        },
        {
          key: 'payload',
          step: 'payload',
          type: 'textarea',
          rows: 9,
          label: t('settings.notificationChannels.payload'),
          help: t('settings.notificationChannels.payloadHelp', { placeholders: PAYLOAD_PLACEHOLDERS }),
          placeholder: DEFAULT_PAYLOAD,
          hidden: true,
          showWhen: (i) => channelType(i) === 'webhook',
        },
      ],
    },
    syslogServers: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.syslog'),
      type: 'syslogserver',
      label: t('settings.syslogServers.label'),
      labelPlural: t('settings.syslogServers.labelPlural'),
      description: t('settings.syslogServers.description'),
      icon: 'tower-broadcast',
      selectable: false,
      // a server has its own page (pages/admin/syslog-server.vue) : its row and Edit open it, Add
      // the wizard
      openPage: (item) => `/settings/syslog/${item.id}`,
      // the dialog in steps : the server, where it listens, what it gets and how it is written
      steps: [
        { key: 'server', label: t('settings.syslogServers.stepServer') },
        { key: 'connection', label: t('settings.syslogServers.stepConnection') },
        { key: 'messages', label: t('settings.syslogServers.stepMessages') },
      ],
      // in the row menu : editing, turning it on or off, a test message (on its page), then
      // Delete last, each apart
      actions: [
        { name: 'edit', title: t('settings.syslogServers.editServer'), icon: 'pencil', color: 'edit' },
        {
          name: 'enable',
          title: t('settings.syslogServers.enable'),
          icon: 'toggle-on',
          color: 'edit',
          dividerBefore: true,
          // only the one that changes it : Enable on a disabled server, Disable on an enabled one
          shownWhen: (m) => !m.enabled,
          update: () => ({ enabled: 1 }),
        },
        {
          name: 'disable',
          title: t('settings.syslogServers.disable'),
          icon: 'toggle-off',
          color: 'edit',
          dividerBefore: true,
          shownWhen: (m) => !!m.enabled,
          update: () => ({ enabled: 0 }),
        },
        {
          name: 'send_test',
          title: t('settings.syslogServers.sendTest'),
          icon: 'paper-plane',
          color: 'test',
          dividerBefore: true,
          // its page, the message sent there once it is open (a tab of its own no more)
          to: (m) => ({ path: `/settings/syslog/${m.id}`, query: { test: '1' } }),
        },
        { name: 'delete', title: t('settings.syslogServers.deleteServer'), icon: 'trash', color: 'delete' },
      ],
      fields: [
        { key: 'id', hidden: true, noInput: true, noTable: true },
        {
          // sending or not : a yes / no column ; a new server is enabled, the row menu turns it
          // on or off
          key: 'enabled',
          label: t('settings.syslogServers.enabled'),
          type: 'checkbox',
          noInput: true,
        },
        { key: 'name', label: t('settings.fields.name'), required: true, icon: 'heading' },
        { key: 'description', label: t('settings.fields.description'), icon: 'info-circle' },
        {
          // where it listens, as the table shows it : not a field of the dialog
          key: 'address',
          label: t('settings.syslogServers.address'),
          noInput: true,
          render: (v, row) => esc(syslogAddress(row)),
          sortValue: (r) => syslogAddress(r),
          // in Columns : the description shows instead
          hidden: true,
        },
        {
          key: 'protocol',
          step: 'connection',
          label: t('settings.syslogServers.protocol'),
          help: t('settings.syslogServers.protocolHelp'),
          icon: 'network-wired',
          type: 'select',
          parent: 'syslogProtocols',
          values: ['udp4', 'tcp4', 'tls4', 'udp6', 'tcp6', 'tls6', 'unix', 'unix-connect'].map((value) => ({
            value,
            label: value,
          })),
          valueKey: 'value',
          labelKey: 'label',
          initial: (r) => r?.protocol || 'udp4',
          hideBelow: 740,
        },
        {
          key: 'host',
          step: 'connection',
          label: t('settings.syslogServers.host'),
          help: t('settings.syslogServers.hostHelp'),
          placeholder: 'syslog.example.com',
          icon: 'server',
          hidden: true,
          showWhen: (i) => !String(i?.protocol || 'udp4').startsWith('unix'),
        },
        {
          key: 'port',
          step: 'connection',
          type: 'number',
          label: t('settings.syslogServers.port'),
          help: t('settings.syslogServers.portHelp'),
          initial: (r) => r?.port ?? 514,
          icon: 'arrows-alt-v',
          hidden: true,
          showWhen: (i) => !String(i?.protocol || 'udp4').startsWith('unix'),
        },
        {
          key: 'path',
          step: 'connection',
          label: t('settings.syslogServers.path'),
          help: t('settings.syslogServers.pathHelp'),
          placeholder: '/dev/log',
          icon: 'folder',
          hidden: true,
          showWhen: (i) => String(i?.protocol || '').startsWith('unix'),
        },
        {
          // the server log, the audit entries, or both
          key: 'receives',
          step: 'messages',
          label: t('settings.syslogServers.receives'),
          help: t('settings.syslogServers.receivesHelp'),
          icon: 'inbox',
          type: 'select',
          parent: 'syslogReceives',
          values: ['both', 'audit', 'log'].map((value) => ({
            value,
            label: t(`settings.syslogServers.receives_${value}`),
          })),
          valueKey: 'value',
          labelKey: 'label',
          initial: (r) => r?.receives || 'both',
          render: (v) => syslogReceivesText(t, v),
        },
        {
          key: 'level',
          step: 'messages',
          label: t('settings.syslogServers.level'),
          help: t('settings.syslogServers.levelHelp'),
          icon: 'signal',
          type: 'select',
          parent: 'syslogLevels',
          values: ['error', 'warning', 'notice', 'info', 'debug'].map((value) => ({ value, label: value })),
          valueKey: 'value',
          labelKey: 'label',
          initial: (r) => r?.level || 'info',
          hideBelow: 900,
        },
        {
          key: 'type',
          step: 'messages',
          label: t('settings.syslogServers.type'),
          help: t('settings.syslogServers.typeHelp'),
          icon: 'file-lines',
          type: 'select',
          parent: 'syslogTypes',
          values: [
            { value: 'BSD', label: 'BSD (RFC 3164)' },
            { value: '5424', label: 'RFC 5424' },
          ],
          valueKey: 'value',
          labelKey: 'label',
          initial: (r) => r?.type || 'BSD',
          hidden: true,
        },
        {
          key: 'app_name',
          step: 'messages',
          label: t('settings.syslogServers.appName'),
          help: t('settings.syslogServers.appNameHelp'),
          placeholder: 'AnsibleForms',
          icon: 'tag',
          hidden: true,
        },
        {
          key: 'source',
          step: 'messages',
          label: t('settings.syslogServers.source'),
          help: t('settings.syslogServers.sourceHelp'),
          placeholder: 'localhost',
          icon: 'desktop',
          hidden: true,
        },
      ],
    },
    announcements: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.announcement'),
      type: 'announcement',
      label: t('settings.interface.announcementLabel'),
      labelPlural: t('settings.interface.announcementPlural'),
      description: t('settings.interface.announcementDescription'),
      icon: 'bullhorn',
      selectable: false,
      // an announcement has its own page (pages/admin/announcement.vue) : its row and Edit open it,
      // Add announcement the wizard (a new one, enabled)
      openPage: (item) => `/settings/announcements/${item.id}`,
      // New opens the wizard : what it says, then when it shows
      steps: [
        { key: 'message', label: t('settings.interface.announcementStepMessage') },
        { key: 'when', label: t('settings.interface.announcementStepWhen') },
      ],
      actions: [
        { name: 'edit', title: t('settings.interface.announcementEdit'), icon: 'pencil', color: 'edit' },
        {
          // Enable : shown under the header again, from its start until its end
          name: 'enable',
          title: t('settings.interface.announcementEnable'),
          icon: 'check',
          color: 'change',
          enabledWhen: (r) => !r.enabled,
          dividerBefore: true,
          done: () => t('settings.interface.announcementEnabledDone'),
          run: async (ids) => {
            await axios.put(`/api/v2/announcement/${ids[0]}`, { enabled: true });
            return 1;
          },
        },
        {
          // Disable : hidden, kept to show again
          name: 'disable',
          title: t('settings.interface.announcementDisable'),
          icon: 'ban',
          color: 'change',
          enabledWhen: (r) => !!r.enabled,
          done: () => t('settings.interface.announcementDisabledDone'),
          run: async (ids) => {
            await axios.put(`/api/v2/announcement/${ids[0]}`, { enabled: false });
            return 1;
          },
        },
        {
          name: 'delete',
          title: t('settings.interface.announcementDelete'),
          icon: 'trash',
          color: 'delete',
        },
      ],
      fields: [
        { key: 'id', hidden: true, noInput: true, noTable: true },
        {
          // shown under the header or not, first as every list's Enabled ; a new one is
          key: 'enabled',
          label: t('settings.interface.announcementEnabled'),
          type: 'checkbox',
          noInput: true,
        },
        {
          key: 'message',
          label: t('settings.interface.banner'),
          help: t('settings.interface.bannerHelp'),
          required: true,
          icon: 'bullhorn',
        },
        {
          // its colour and icon under the header
          key: 'level',
          label: t('settings.interface.bannerLevel'),
          help: t('settings.interface.bannerLevelHelp'),
          icon: 'circle-info',
          type: 'select',
          // its choices (a select reads them from a parent list)
          parent: 'announcementLevels',
          values: ['info', 'warning', 'danger'].map((value) => ({
            value,
            label: t(`settings.interface.banner_${value}`),
          })),
          valueKey: 'value',
          labelKey: 'label',
          initial: (r) => r?.level || 'info',
          render: (v) => announcementLevelPill(t, v),
        },
        {
          key: 'start_at',
          step: 'when',
          icon: 'calendar',
          label: t('settings.interface.bannerStart'),
          help: t('settings.interface.bannerStartHelp'),
          type: 'datetime',
          convertToUtc: true,
          render: (v) => (v ? Helpers.formatServerDate(v) : '–'),
        },
        {
          key: 'end_at',
          step: 'when',
          icon: 'calendar',
          label: t('settings.interface.bannerEnd'),
          help: t('settings.interface.bannerEndHelp'),
          type: 'datetime',
          convertToUtc: true,
          render: (v) => (v ? Helpers.formatServerDate(v) : '–'),
        },
        {
          key: 'created_by',
          label: t('settings.interface.announcementCreatedBy'),
          noInput: true,
          hideBelow: 1200,
          render: (v) => (v ? escapeHtml(v) : '–'),
        },
      ],
    },
    disclaimerVersions: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.disclaimer'),
      type: 'disclaimerversion',
      label: t('settings.disclaimer.label'),
      labelPlural: t('settings.disclaimer.labelPlural'),
      description: t('settings.disclaimer.description'),
      icon: 'layer-group',
      selectable: false,
      // a disclaimer has its own page (pages/admin/disclaimer-version.vue) : its row and Edit open
      // it, Add disclaimer the dialog (a new one, not enabled) ; enabled from its row menu (the one
      // users accept : who accepted it is not asked again), or deleted with who accepted it
      openPage: (item) => `/settings/disclaimer/${item.version}`,
      actions: [
        { name: 'edit', title: t('settings.disclaimer.editDisclaimer'), icon: 'pencil', color: 'edit' },
        {
          // Enable this version : the one users accept (who accepted it is not asked again)
          name: 'restore',
          title: t('settings.disclaimer.restore'),
          icon: 'check',
          color: 'change',
          // the enabled one is the disclaimer already
          enabledWhen: (r) => !r.enabled,
          dividerBefore: true,
          confirm: (_count, rows) => t('settings.disclaimer.restoreConfirm', { version: rows[0].version }),
          done: (version) => t('settings.disclaimer.restoreDone', { version }),
          run: async (ids) => {
            await axios.post(`/api/v2/disclaimerversion/${ids[0]}/enable`, { enabled: true });
            return ids[0];
          },
        },
        {
          // the current one too : the one before is current again (the last one deleted switches
          // the disclaimer off)
          name: 'delete',
          title: t('common.delete'),
          icon: 'trash',
          color: 'delete',
        },
      ],
      fields: [
        { key: 'id', hidden: true, noInput: true, noTable: true },
        {
          // the one users accept, first as every list's Enabled
          key: 'enabled',
          label: t('settings.disclaimer.versionEnabled'),
          type: 'checkbox',
          noInput: true,
        },
        { key: 'version', label: t('settings.disclaimer.version'), icon: 'hashtag', noInput: true },
        {
          key: 'title',
          label: t('settings.disclaimer.title'),
          help: t('settings.disclaimer.titleHelp'),
          icon: 'heading',
          required: true,
        },
        {
          key: 'text',
          label: t('settings.disclaimer.text'),
          type: 'textarea',
          rows: 10,
          icon: 'file-lines',
          help: t('settings.disclaimer.textHelp'),
          required: true,
          noTable: true,
        },
        {
          key: 'checkbox_label',
          label: t('settings.disclaimer.checkbox'),
          dialogLabel: t('settings.disclaimer.checkboxShort'),
          icon: 'square-check',
          help: t('settings.disclaimer.checkboxHelp'),
          required: true,
          noTable: true,
          // a new one : the usual words, to change at will
          initial: (r) => r?.checkbox_label || t('settings.disclaimer.checkboxDefault'),
        },
        { key: 'created_by', label: t('settings.disclaimer.publishedBy'), noInput: true },
        {
          key: 'created_at',
          label: t('settings.disclaimer.publishedAt'),
          type: 'datetime',
          noInput: true,
          render: (v) => (v ? Helpers.formatServerDate(v) : '–'),
        },
        { key: 'acceptances', label: t('settings.disclaimer.tabAcceptances'), noInput: true, align: 'end' },
        // the current one (a column of the api, not shown)
        { key: 'current', noInput: true, noTable: true },
      ],
    },
    secretStores: {
      // the page title is the menu entry's label (AppSidebar), so the two always match
      pageTitle: t('sidebar.secretStores'),
      type: 'secretstore',
      label: t('settings.secretStores.label'),
      description: t('settings.secretStores.description'),
      icon: 'vault',
      selectable: false,
      // the dialog in steps : what the store is, its type, where it is, how the app logs in, the
      // type's options
      steps: [
        { key: 'store', label: t('settings.secretStores.stepStore') },
        { key: 'type', label: t('settings.secretStores.stepType') },
        { key: 'credentials', label: t('settings.secretStores.stepAuth') },
        { key: 'connection', label: t('settings.secretStores.stepConnection') },
        { key: 'options', label: t('settings.secretStores.stepOptions') },
      ],
      // the switches are not stored : ignore_certs, a CA bundle and a namespace are
      beforeSave: ({ skip_verify, custom_ca, vault_enterprise, ...item }) => ({
        ...item,
        // no namespace but in a Vault Enterprise
        namespace: item.type === 'vault' && vault_enterprise ? item.namespace || '' : '',
        ignore_certs: !!skip_verify,
        ca_bundle: !skip_verify && custom_ca ? item.ca_bundle || '' : '',
      }),
      // a store has its own page (pages/admin/secret-store.vue) : its row and Edit open it, New the
      // wizard
      openPage: (item) => `/settings/secret-stores/${item.id}`,
      // in the row menu, as the runners' : editing, the test, its credentials (on its page), then
      // Delete last, each apart
      actions: [
        { name: 'edit', title: t('settings.secretStores.editStore'), icon: 'pencil', color: 'edit' },
        {
          name: 'test',
          title: t('settings.common.testConnection'),
          icon: 'plug',
          color: 'test',
          dividerBefore: true,
        },
        {
          // the credential it logs in with : its page's Credentials tab
          name: 'change_credentials',
          title: t('settings.repositories.changeCredentials'),
          icon: 'key',
          color: 'change',
          dividerBefore: true,
          to: (r) => `/settings/secret-stores/${r.id}/credentials`,
        },
        { name: 'delete', title: t('settings.secretStores.deleteStore'), icon: 'trash', color: 'delete' },
      ],
      fields: [
        {
          key: 'id',
          label: t('settings.fields.id'),
          sortable: false,
          required: false,
          filterable: false,
          noInput: true,
          hidden: true,
          icon: 'key',
        },
        {
          key: 'name',
          icon: 'heading',
          line: 0,
          label: t('settings.fields.name'),
          required: true,
          filterable: true,
          help: t('settings.secretStores.nameHelp'),
        },
        {
          // HashiCorp Vault or CyberArk CCP : radio buttons ; the list shows its name
          key: 'type',
          step: 'type',
          label: t('settings.secretStores.type'),
          required: true,
          filterable: true,
          type: 'radio',
          // a short name beside the radio, the rest in its hint ; Vault last, its Vault Enterprise
          // switch right under it
          options: [...SECRET_STORE_TYPES].reverse().map(({ value, short, label }) => ({
            value,
            label: short || label,
            hint: t(`settings.secretStores.type_${value}Hint`),
          })),
          initial: (r) => r?.type || 'vault',
          render: (v) => escapeHtml(SECRET_STORE_TYPES.find((x) => x.value === v)?.label || v || ''),
        },
        {
          // a Vault Enterprise : its namespaces (not stored : a namespace is, see beforeSave)
          key: 'vault_enterprise',
          step: 'type',
          type: 'checkbox',
          flush: true,
          label: t('settings.secretStores.enterprise'),
          help: t('settings.secretStores.enterpriseHelp'),
          initial: (r) => !!String(r?.namespace || '').trim(),
          noTable: true,
          dependency: 'type',
          dependencyValues: ['vault'],
          // a CyberArk has no namespaces
          defaultMap: { cyberark_ccp: false },
        },
        {
          key: 'description',
          icon: 'info-circle',
          line: 0,
          label: t('settings.fields.description'),
          required: false,
        },
        {
          key: 'url',
          step: 'connection',
          icon: 'globe',
          line: 1,
          label: t('settings.fields.uri'),
          required: true,
          // an example of the type chosen
          placeholder: (r) =>
            r.type === 'cyberark_ccp' ? 'https://ccp.example.com' : 'https://vault.example.com:8200',
          // in Columns : the description shows instead
          hidden: true,
          dependency: 'type',
        },
        {
          // how it logs in : a credential of Connections > Credentials, or a New one - a Vault's
          // password is its token, a CyberArk's is a cyberark credential (its AppID, client
          // certificate and key)
          key: 'credential',
          step: 'credentials',
          icon: 'key',
          label: t('settings.secretStores.credential'),
          help: (r) =>
            t(
              r.type === 'cyberark_ccp'
                ? 'settings.secretStores.helpCredentialCyberark'
                : 'settings.secretStores.helpCredential',
            ),
          hidden: true,
          type: 'select',
          parent: 'credentials',
          values: 'credential',
          valueKey: 'name',
          labelKey: 'name',
          clearable: true,
          createWith: 'credentials',
          createLabel: t('settings.repositories.newCredential'),
          // a credential for an api (its password the token), or a cyberark one
          createDefaults: (r) => ({ credential_type: r.type === 'cyberark_ccp' ? 'cyberark' : 'api' }),
          dependency: 'type',
        },
        {
          // in a credential now ; kept on the record for the stores that still have their own,
          // on no step of the dialog
          key: 'token',
          step: 'own',
          icon: 'lock',
          label: t('settings.fields.token'),
          type: 'password',
          hidden: true,
        },
        {
          key: 'namespace',
          step: 'options',
          // only for a Vault Enterprise
          icon: 'folder',
          line: 2,
          label: t('settings.secretStores.namespace'),
          help: t('settings.secretStores.namespaceHelp'),
          required: false,
          hidden: true,
          dependency: 'vault_enterprise',
        },
        {
          // KV v2 or v1 : radio buttons
          key: 'kv_version',
          step: 'options',
          label: t('settings.secretStores.kvVersion'),
          type: 'radio',
          options: [
            { value: 2, label: 'KV v2', hint: t('settings.secretStores.kv2Hint') },
            { value: 1, label: 'KV v1', hint: t('settings.secretStores.kv1Hint') },
          ],
          initial: (r) => Number(r?.kv_version) || 2,
          required: false,
          hidden: true,
          dependency: 'type',
          dependencyValues: ['vault'],
        },
        {
          key: 'default_mount',
          step: 'options',
          icon: 'folder-open',
          line: 2,
          label: t('settings.secretStores.defaultMount'),
          help: t('settings.secretStores.defaultMountHelp'),
          placeholder: 'secret',
          required: false,
          hidden: true,
          dependency: 'type',
          dependencyValues: ['vault'],
        },
        {
          // in a credential now ; kept on the record for the stores that still have their own,
          // on no step of the dialog
          key: 'app_id',
          step: 'own',
          icon: 'id-badge',
          line: 2,
          label: t('settings.secretStores.appId'),
          help: t('settings.secretStores.appIdHelp'),
          hidden: true,
          dependency: 'type',
          dependencyValues: ['cyberark_ccp'],
        },
        {
          // in a credential now ; kept on the record for the stores that still have their own,
          // on no step of the dialog
          key: 'client_cert',
          step: 'own',
          icon: 'certificate',
          type: 'textarea',
          line: 2,
          label: t('settings.secretStores.clientCert'),
          help: t('settings.secretStores.clientCertHelp'),
          placeholder: '-----BEGIN CERTIFICATE-----',
          required: false,
          hidden: true,
          dependency: 'type',
          dependencyValues: ['cyberark_ccp'],
        },
        {
          // in a credential now ; kept on the record for the stores that still have their own,
          // on no step of the dialog
          key: 'client_key',
          step: 'own',
          icon: 'key',
          type: 'textarea',
          line: 2,
          label: t('settings.secretStores.clientKey'),
          help: t('settings.secretStores.clientKeyHelp'),
          placeholder: '-----BEGIN PRIVATE KEY-----',
          required: false,
          hidden: true,
          dependency: 'type',
          dependencyValues: ['cyberark_ccp'],
        },
        {
          key: 'cache_ttl_seconds',
          step: 'options',
          icon: 'clock',
          line: 3,
          type: 'number',
          label: t('settings.secretStores.cacheTtl'),
          help: t('settings.secretStores.cacheTtlHelp'),
          required: false,
          hidden: true,
          dependency: 'type',
        },
        {
          // the certificate not checked at all : off by default (not stored : ignore_certs is)
          key: 'skip_verify',
          step: 'connection',
          type: 'checkbox',
          label: t('settings.runners.skipVerify'),
          initial: (r) => !!r?.ignore_certs,
          noTable: true,
        },
        {
          // checked against a private authority : its certificates below
          key: 'custom_ca',
          step: 'connection',
          type: 'checkbox',
          label: t('settings.runners.customCa'),
          initial: (r) => !!String(r?.ca_bundle || '').trim(),
          noTable: true,
          dependency: 'skip_verify',
          negateDependency: true,
          // skipping the verification turns it off : its CA bundle goes with it
          defaultMap: { true: false },
        },
        {
          // a column only : the dialog asks skip_verify
          key: 'ignore_certs',
          label: t('settings.ldap.ignoreCerts'),
          type: 'checkbox',
          noInput: true,
          hidden: true,
        },
        {
          key: 'ca_bundle',
          step: 'connection',
          icon: 'certificate',
          type: 'textarea',
          line: 5,
          label: t('settings.fields.caBundle'),
          help: t('settings.runners.caBundleHelp'),
          required: false,
          dependency: 'custom_ca',
          placeholder: '-----BEGIN CERTIFICATE-----',
          hidden: true,
        },
        {
          key: 'extra',
          step: 'options',
          icon: 'code',
          type: 'textarea',
          line: 6,
          label: t('settings.secretStores.extra'),
          help: t('settings.secretStores.extraHelp'),
          placeholder: '{}',
          required: false,
          hidden: true,
          dependency: 'type',
        },
      ],
    },

    backups: {
      icon: 'database',
      type: 'backup',
      label: t('settings.backups.label'),
      labelPlural: t('settings.backups.labelPlural'),
      description: t('settings.backups.description'),
      idKey: 'folder',
      actions: [
        { name: 'preview', title: t('settings.backups.showBackup'), icon: 'info-circle', color: 'change' },
        { name: 'trigger', icon: 'undo', title: t('settings.backups.restore'), color: 'warning' },
        { name: 'delete', icon: 'trash', title: t('common.delete'), color: 'danger' },
      ],
      fields: [
        { key: 'folder', label: t('settings.backups.folder'), noInput: true },
        // rendered with formatServerDate, not dayjs : the server already converted
        // this into the application timezone, so re-converting it in the browser
        // made the date disagree with the folder name beside it
        {
          key: 'date',
          label: t('settings.fields.date'),
          type: 'datetime',
          noInput: true,
          render: (v) => Helpers.formatServerDate(v),
        },
        { key: 'description', label: t('settings.fields.description'), type: 'text' },
      ],
    },
  };
  // the LDAP directories' list : a directory's own fields (all.ldap), its tabs the New dialog's
  // steps
  all.ldapDirectories = ldapDirectories(t, all.ldap);
  return all;
}

// a new directory's values : on, the usual Active Directory port and attributes
const NEW_DIRECTORY = { enable: true, port: 389, username_attribute: 'sAMAccountName', groups_attribute: 'memberOf' };

/**
 * Settings > Access > LDAP : the directories, each opening its own page (ldap-directory.vue). The
 * list shows its name, servers, whether it is on and its lookup order ; New asks every field of a
 * directory, its page's tabs as steps.
 *
 * Args:
 *   t (function): the translation function.
 *   ldap (object): a directory's settings (fields, each in its tab).
 *
 * Returns:
 *   object: the list's settings (AppAdminMulti).
 */
function ldapDirectories(t, ldap) {
  // the columns : on or off (first, as every list's Enabled), the name, the description ; never sorted,
  // so the list is always in the lookup order
  const column = {
    name: { sortable: false, filterable: true },
    description: { sortable: false, filterable: true },
    // a ✓ as every list's Enabled, first as theirs
    enable: { sortable: false, label: t('settings.ldap.enabled'), type: 'checkbox' },
  };
  // the columns first, in their order ; the dialog's fields keep theirs within each step
  const COLUMNS = ['enable', 'name', 'description'];
  const columnOrder = (key) => (COLUMNS.includes(key) ? COLUMNS.indexOf(key) : COLUMNS.length);
  return {
    pageTitle: t('sidebar.ldap'),
    type: 'ldapdirectory',
    label: t('settings.ldap.directory'),
    description: t('settings.ldap.directoriesDescription'),
    icon: 'address-book',
    selectable: false,
    steps: [
      { key: 'general', label: t('settings.common.tabDetails') },
      { key: 'credentials', label: t('settings.common.tabCredentials') },
      { key: 'users', label: t('settings.ldap.tabUsers') },
      { key: 'groups', label: t('settings.ldap.tabGroups') },
    ],
    openPage: (item) => `/settings/ldap/${item.id}`,
    actions: [
      { name: 'edit', title: t('settings.ldap.editDirectory'), icon: 'pencil', color: 'edit' },
      { name: 'test', title: t('settings.common.testConnection'), icon: 'plug', color: 'test', dividerBefore: true },
      {
        // its place in the lookup order : one up, one down (the page moves it, ldap.vue)
        name: 'move_up',
        title: t('settings.ldap.moveUp'),
        icon: 'arrow-up',
        color: 'change',
        dividerBefore: true,
        enabledWhen: (r) => !r.isFirst,
      },
      {
        name: 'move_down',
        title: t('settings.ldap.moveDown'),
        icon: 'arrow-down',
        color: 'change',
        enabledWhen: (r) => !r.isLast,
      },
      {
        // never the default directory : it is turned off instead
        name: 'delete',
        title: t('settings.ldap.deleteDirectory'),
        icon: 'trash',
        color: 'delete',
        enabledWhen: (r) => r.name !== 'default',
      },
    ],
    fields: [
      { key: 'id', hidden: true, noInput: true, noTable: true },
      ...[...ldap.fields]
        .sort((a, b) => columnOrder(a.key) - columnOrder(b.key))
        .map(({ tab, isToggle: _toggle, disabledWhen: _rule, ...f }) => ({
          ...f,
          step: tab,
          // a new directory has no name to keep : the default one exists already
          ...(column[f.key] || { noTable: true }),
          // a new one : on, the usual Active Directory port and attributes
          ...(NEW_DIRECTORY[f.key] !== undefined ? { initial: () => NEW_DIRECTORY[f.key] } : {}),
          // a new one binds with a credential (one from before credentials may have its own account)
          ...(f.key === 'credential' ? { required: true } : {}),
        })),
    ],
  };
}
