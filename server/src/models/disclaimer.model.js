'use strict';
/******************************************************************/
/*                                                                */
/*  The disclaimer users accept once (Settings > Access >         */
/*  Disclaimer) : switched on, every signed-in request waits for  */
/*  its acceptance (Middleware.disclaimerGate), and each one is   */
/*  recorded - who, which version, when, from where.              */
/*                                                                */
/*  Each version keeps its text as it was agreed to : a change    */
/*  that asks everyone again makes a new version, a correction    */
/*  rewrites the current one.                                     */
/*                                                                */
/******************************************************************/
import mysql from './db.model.js';
import Errors from '../lib/errors.js';
import logger from '../lib/logger.js';
import { bump, onEpoch } from '../lib/epochs.js';

// ─── limits ──────────────────────────────────────────────────────────────────

export const MAX_TITLE = 200;
export const MAX_TEXT = 20000;
export const MAX_CHECKBOX = 200;
// how long a node trusts what it read of the current version : another node's change reaches it
// sooner through the 'disclaimer' epoch
const CACHE_MS = 30 * 1000;

// ─── caches ──────────────────────────────────────────────────────────────────

let currentCache = { value: undefined, at: 0 };
// who accepted the current version : '<type>|<username>|<version>'
const accepted = new Set();

/**
 * Forgets what this node read : the current version and who accepted it.
 */
export function forgetDisclaimer() {
  currentCache = { value: undefined, at: 0 };
  accepted.clear();
}
onEpoch('disclaimer', forgetDisclaimer);

/**
 * A moment as the database keeps it : UTC, YYYY-MM-DD HH:MM:SS.
 *
 * Returns:
 *   string: now.
 */
function nowDb() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * A text field of the disclaimer, trimmed and cut to its column.
 *
 * Args:
 *   value (any): the value sent.
 *   max (number): its longest.
 *
 * Returns:
 *   string: the text, maybe empty.
 */
function clean(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * An address as people write it : an IPv4 one seen through an IPv6 socket (::ffff:10.0.0.5)
 * without its prefix.
 *
 * Args:
 *   ip (string): the address.
 *
 * Returns:
 *   string: the address.
 */
export function plainIp(ip) {
  return ip.replace(/^::ffff:(?=\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$)/i, '');
}

/**
 * The key of a user's acceptance of a version.
 *
 * Args:
 *   user (object): the signed-in user, its username and type.
 *   version (number): the version.
 *
 * Returns:
 *   string: '<type>|<username>|<version>'.
 */
function keyOf(user, version) {
  return `${user?.type || 'local'}|${user?.username || ''}|${version}`;
}

const Disclaimer = {
  /**
   * The disclaimer as it stands : switched on or not, and its current version.
   *
   * Returns:
   *   Promise<object>: { enabled, version (0 : none yet), title, text, checkbox_label }.
   */
  async current() {
    if (currentCache.value !== undefined && Date.now() - currentCache.at < CACHE_MS) return currentCache.value;
    const [settings, versions] = await Promise.all([
      mysql.do('SELECT disclaimer_enabled FROM AnsibleForms.`settings` LIMIT 1'),
      mysql.do('SELECT version, title, text, checkbox_label FROM AnsibleForms.`disclaimer_versions` ORDER BY version DESC LIMIT 1'),
    ]);
    const v = versions[0];
    const value = {
      enabled: !!settings[0]?.disclaimer_enabled && !!v,
      version: v?.version || 0,
      title: v?.title || '',
      text: v?.text || '',
      checkbox_label: v?.checkbox_label || '',
    };
    currentCache = { value, at: Date.now() };
    return value;
  },

  /**
   * Whether a user still has to accept : the disclaimer is on and they have not accepted its
   * current version.
   *
   * Args:
   *   user (object): the signed-in user, its username and type.
   *
   * Returns:
   *   Promise<boolean>: true while they have to.
   */
  async isRequired(user) {
    const current = await this.current();
    if (!current.enabled) return false;
    const key = keyOf(user, current.version);
    if (accepted.has(key)) return false;
    const res = await mysql.do(
      'SELECT 1 FROM AnsibleForms.`disclaimer_acceptances` WHERE username = ? AND user_type = ? AND version = ? LIMIT 1',
      [user?.username || '', user?.type || 'local', current.version],
    );
    if (res.length) {
      accepted.add(key);
      return false;
    }
    return true;
  },

  /**
   * Records that a user accepted a version : the one they were shown, which has to be the
   * current one.
   *
   * Args:
   *   user (object): the signed-in user, its username and type.
   *   version (number): the version they accepted.
   *   ip (string): where from.
   *   userAgent (string): their browser.
   *
   * Raises:
   *   BadRequestError: no disclaimer is on, or the version is not the current one (it changed
   *     while they read it).
   */
  async accept(user, version, ip, userAgent) {
    const current = await this.current();
    if (!current.enabled) throw new Errors.BadRequestError('No disclaimer to accept');
    if (Number(version) !== current.version) {
      throw new Errors.BadRequestError('The disclaimer changed : read it again');
    }
    await mysql.do(
      'INSERT IGNORE INTO AnsibleForms.`disclaimer_acceptances` SET ?',
      {
        username: user?.username || '',
        user_type: user?.type || 'local',
        version: current.version,
        accepted_at: nowDb(),
        ip: ip ? plainIp(String(ip)).slice(0, 64) : null,
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      },
    );
    accepted.add(keyOf(user, current.version));
    logger.notice(`${user?.username} (${user?.type}) accepted the disclaimer, version ${current.version}`);
  },

  /**
   * Saves the disclaimer : switched on or off, and its text. A changed text makes a new version
   * when everyone is to accept again (askAgain, and always the first time), else it rewrites
   * the current one.
   *
   * Args:
   *   data (object): enabled, title, text, checkbox_label, askAgain.
   *   admin (string): who saves it.
   *
   * Returns:
   *   Promise<object>: the disclaimer as it now stands (current()).
   *
   * Raises:
   *   BadRequestError: switched on without a title, a text or a checkbox label.
   */
  async save(data, admin) {
    const current = await this.current();
    const title = data.title !== undefined ? clean(data.title, MAX_TITLE) : current.title;
    const text = data.text !== undefined ? clean(data.text, MAX_TEXT) : current.text;
    const checkboxLabel = data.checkbox_label !== undefined ? clean(data.checkbox_label, MAX_CHECKBOX) : current.checkbox_label;
    const enabled = data.enabled !== undefined ? !!data.enabled : current.enabled;
    // step 1 : what it needs to be shown
    if (enabled && (!title || !text || !checkboxLabel)) {
      throw new Errors.BadRequestError('A disclaimer needs a title, a text and the label of its checkbox');
    }
    // step 2 : its text, when it changed - a new version, or the current one rewritten
    const changed = title !== current.title || text !== current.text || checkboxLabel !== current.checkbox_label;
    if (changed && title && text && checkboxLabel) {
      if (!current.version || data.askAgain) {
        await mysql.do('INSERT INTO AnsibleForms.`disclaimer_versions` SET ?', {
          version: current.version + 1,
          title,
          text,
          checkbox_label: checkboxLabel,
          created_by: admin || null,
          created_at: nowDb(),
        });
      } else {
        await mysql.do(
          'UPDATE AnsibleForms.`disclaimer_versions` SET title = ?, text = ?, checkbox_label = ? WHERE version = ?',
          [title, text, checkboxLabel, current.version],
        );
      }
    }
    // step 3 : on or off
    await mysql.do('UPDATE AnsibleForms.`settings` SET disclaimer_enabled = ?', [enabled ? 1 : 0]);
    // every node reads it again (this one now)
    forgetDisclaimer();
    bump('disclaimer');
    return this.current();
  },

  /**
   * The disclaimer as the settings page edits it : what current() says, switched on or not even
   * without a version yet.
   *
   * Returns:
   *   Promise<object>: { enabled, version, title, text, checkbox_label }.
   */
  async forSettings() {
    const current = await this.current();
    const settings = await mysql.do('SELECT disclaimer_enabled FROM AnsibleForms.`settings` LIMIT 1');
    return { ...current, enabled: !!settings[0]?.disclaimer_enabled };
  },

  /**
   * Every version, the latest first : its text as it was agreed to, who made it, when, and how
   * many accepted it.
   *
   * Returns:
   *   Promise<object[]>: the versions, each with its id (its number) and its acceptances.
   */
  async versions() {
    return mysql.do(
      'SELECT v.version AS id, v.version, v.title, v.text, v.checkbox_label, v.created_by, v.created_at, ' +
        '(SELECT COUNT(*) FROM AnsibleForms.`disclaimer_acceptances` a WHERE a.version = v.version) AS acceptances ' +
        'FROM AnsibleForms.`disclaimer_versions` v ORDER BY v.version DESC',
    );
  },

  /**
   * One version, as versions() lists it.
   *
   * Args:
   *   version (number|string): its number.
   *
   * Returns:
   *   Promise<object>: the version.
   *
   * Raises:
   *   NotFoundError: no version has that number.
   */
  async version(version) {
    const found = (await this.versions()).find((v) => String(v.version) === String(version));
    if (!found) throw new Errors.NotFoundError(`No disclaimer version ${version}`);
    return found;
  },

  /**
   * Every acceptance, the latest first : who, which version, when, from where.
   *
   * Returns:
   *   Promise<object[]>: the acceptances.
   */
  async acceptances() {
    const rows = await mysql.do(
      'SELECT id, username, user_type, version, accepted_at, ip, user_agent FROM AnsibleForms.`disclaimer_acceptances` ORDER BY accepted_at DESC, id DESC',
    );
    // those recorded with the prefix, shown without it
    return rows.map((r) => ({ ...r, ip: r.ip ? plainIp(r.ip) : r.ip }));
  },
};

export default Disclaimer;
