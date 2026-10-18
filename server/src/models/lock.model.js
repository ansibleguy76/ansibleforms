'use strict';
import logger from "../lib/logger.js";
import yaml from "yaml";
import config from '../../config/app.config.js';
import moment from "moment";
import Repository from "./repository.model.js";
import mysql from "./db.model.js";

import Errors from '../lib/errors.js';
import { publish } from "../lib/liveEvents.js";

// The designer lock : who is editing the forms. It lives in the database (one row, id 1) since
// 7 ; before, it was the file LOCK_PATH, which every app node saw only when they shared that
// file.
const LOCK_ID = 1;
// the row's holder is this user (data is the holder as JSON)
// (JSON_VALID first : MySQL raises an error on JSON_EXTRACT of text that is not JSON)
const HOLDER_IS = "JSON_VALID(data) AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.username'))=? AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.type'))=?";

// The holder's open designer asks for the lock every few seconds (its status), which marks it
// seen. A lock not seen for this long is left behind - the browser closed, the computer shut
// down, the network gone - and is free again, so nobody waits on a designer nobody has open.
export const LOCK_STALE_SECONDS = 300;
// how often the holder's asking writes that it was seen : not at every poll
const SEEN_EVERY_SECONDS = 30;
const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

//lock object create
var Lock=function(){

};

/**
 * When the lock was last seen : its holder's last status, else when it was taken.
 *
 * Args:
 *   lock (object): the lock as stored.
 *
 * Returns:
 *   moment|null: the time, or null when it has none (written by hand).
 */
function lastSeen(lock) {
  const at = lock?.seen || lock?.created;
  const m = at ? moment(at, TIME_FORMAT) : null;
  return m && m.isValid() ? m : null;
}

// An admin's force release : instead of deleting the row, it is overwritten with this record,
// { released: true, holder: { username, type }, releasedBy: { username, type, displayName },
// created }. It reads as FREE everywhere (Lock.read), anybody may take it (Lock.set), and the
// former holder's designer learns from Lock.status that the lock was taken from it - and by
// whom. Deleting the row told that designer only "free", which it took for its own lock left
// behind (the computer asleep past LOCK_STALE_SECONDS) and took straight back, undoing the
// admin's release within seconds. The record ages out like any lock, after LOCK_STALE_SECONDS.
const RELEASED_IS = "JSON_VALID(data) AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.released'))='true'";

/**
 * Whether a stored lock is an admin's force-release record rather than a held lock.
 *
 * Args:
 *   lock (object|null): the lock as stored.
 *
 * Returns:
 *   boolean: true for the record Lock.forceRelease writes.
 */
function isReleased(lock) {
  return lock?.released === true;
}

// the lock as stored, or null when free ; no designer check, for the background jobs and the
// Status page. A lock left behind (not seen for LOCK_STALE_SECONDS) is released here : only
// while it is still the row read, so a holder who comes back at that moment keeps it.
// withRelease : answer an admin's force-release record as it is (Lock.status tells the former
// holder) ; everyone else reads it as null, free.
Lock.read = async function({ withRelease = false } = {}){
  // a force-release record is free unless the caller asked to see it
  const visible = (lock) => (isReleased(lock) && !withRelease ? null : lock);
  const rows = await mysql.do("SELECT data FROM AnsibleForms.`designer_lock` WHERE id=?", [LOCK_ID], true);
  if (!rows.length || !rows[0].data) return null;
  let lock;
  try {
    lock = JSON.parse(rows[0].data);
  } catch {
    // written by hand or truncated : still held, by somebody unknown
    return {};
  }
  const seen = lastSeen(lock);
  if (seen && moment().diff(seen, 'seconds') > LOCK_STALE_SECONDS) {
    const res = await mysql.do("DELETE FROM AnsibleForms.`designer_lock` WHERE id=? AND data=?", [LOCK_ID, rows[0].data]);
    if (res.affectedRows) {
      // a force-release record only ages out : it was free already, nobody needs telling
      if (!isReleased(lock)) {
        logger.notice(`Released the designer lock of ${lock.username}, not seen since ${seen.format(TIME_FORMAT)}`);
        // every open designer and header learns it is free (lib/liveEvents.js)
        publish("designer");
      }
      return null;
    }
    // changed meanwhile (its holder came back) : what is there now, as it is - read once more,
    // never in a loop
    const again = await mysql.do("SELECT data FROM AnsibleForms.`designer_lock` WHERE id=?", [LOCK_ID], true);
    if (!again?.length || !again[0].data) return null;
    try {
      return visible(JSON.parse(again[0].data));
    } catch {
      return {};
    }
  }
  return visible(lock);
};
// lightweight check : is the designer lock currently held by anyone ? used by
// background jobs (cron pull) to avoid running git on a working tree while the
// designer is editing it, even before the first save makes the tree dirty
// (issue #414)
Lock.isHeld = async function(){
  try {
    return (await Lock.read()) !== null;
  } catch (e) {
    logger.warning(`Could not read the designer lock: ${e.message || e}`);
    return false;
  }
};
Lock.status = async function(user){
  const lck = yaml.parse(await Lock.get(user, { withRelease: true }) || "null");
  if (!lck) return { free: true };
  // released by an admin : free - and its former holder is told by whom, so their designer
  // does not take it back as a lock merely left behind (see RELEASED_IS)
  if (isReleased(lck)) {
    const wasMine = lck.holder?.username === user.username && lck.holder?.type === user.type;
    if (!wasMine) return { free: true };
    const by = lck.releasedBy || {};
    return { free: true, released: { by: by.displayName || by.username || '' } };
  }
  const match = ((user.username === lck.username) && (user.type === lck.type));
  // its holder's designer is open : the lock is seen (not left behind)
  if (match) await Lock.markSeen(user, lck);
  return { lock: lck, match, free: false };
};
// Exclusive : the lock is taken only when it is free, or already this user's (then its time
// is refreshed). Two designers asking at once - on one node or on two - get one winner ; the
// other is answered 423, which the designer shows as "locked by". Nobody takes it from somebody
// else : only its holder releases it (lock.controller.js delete).
Lock.set = async function (user) {
  if (config.showDesigner && user.options.showDesigner) {
    logger.notice(`Creating lock for user ${user.username}`);
    const copy = { ...user, created: moment(Date.now()).format('YYYY-MM-DD HH:mm:ss') };
    const data = JSON.stringify(copy);
    const taken = await mysql.do(
      "INSERT IGNORE INTO AnsibleForms.`designer_lock` (id, data, created) VALUES (?, ?, NOW())",
      [LOCK_ID, data]);
    if (!taken.affectedRows) {
      // ours already (its time refreshed), or an admin's force-release record (free)
      const refreshed = await mysql.do(
        "UPDATE AnsibleForms.`designer_lock` SET data=?, created=NOW() WHERE id=? AND ((" + HOLDER_IS + ") OR (" + RELEASED_IS + "))",
        [data, LOCK_ID, user.username, user.type]);
      if (!refreshed.affectedRows) {
        const holder = (await Lock.read())?.username || "another user";
        throw new Errors.ApiError(`The designer is locked by ${holder}`, 423);
      }
    }
    // refresh the forms repositories first so the designer edits the latest
    // remote state (best effort ; a dirty tree or network error must not block
    // the designer, unpushed work is preserved by the rebase on sync) - once the lock is
    // ours, so the pull never runs under somebody else's open designer
    try {
      await Repository.pullFormsRepositories();
    } catch (e) {
      logger.warning(`Failed to refresh the forms repositories: ${e.message}`);
    }
    // every open designer and header learns who holds it, at once (lib/liveEvents.js)
    publish("designer");
    return { message: 'Lock set', user: { username: copy.username, type: copy.type } };
  }
  logger.error("Designer is disabled, can't set lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};
// onlyMine : release the lock only while it is still this user's - a request that took the
// lock for itself (a config save) must not delete one a designer took in the meantime
Lock.delete = async function(user={}, { onlyMine = false } = {}){
  if (config.showDesigner && user.options.showDesigner) {
    logger.notice(`Deleting lock`);
    const res = onlyMine
      ? await mysql.do("DELETE FROM AnsibleForms.`designer_lock` WHERE id=? AND " + HOLDER_IS, [LOCK_ID, user.username, user.type])
      : await mysql.do("DELETE FROM AnsibleForms.`designer_lock` WHERE id=?", [LOCK_ID]);
    // deleting a non-existent lock is idempotent
    if (!res.affectedRows) return { message: 'Lock not present', deleted: false };
    publish("designer");
    return { message: 'Lock deleted' };
  }
  logger.error("Designer is disabled, can't delete lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};
/**
 * Releases somebody else's lock, as an admin : the row is overwritten with a force-release
 * record (see RELEASED_IS) rather than deleted, so the former holder's designer can tell the
 * release apart from its own lock left behind and does not take it back.
 *
 * Args:
 *   admin (object): the admin releasing it (lock.controller.js checked the role).
 *   holder (object): the lock as read, its holder's username and type.
 *
 * Returns:
 *   object: { message } ; nothing changes when the lock was free or already released.
 *
 * Raises:
 *   AccessDeniedError: the designer is disabled.
 */
Lock.forceRelease = async function (admin = {}, holder = {}) {
  if (config.showDesigner && admin.options?.showDesigner) {
    const record = JSON.stringify({
      released: true,
      holder: { username: holder?.username, type: holder?.type },
      releasedBy: { username: admin.username, type: admin.type, displayName: admin.displayName || admin.username },
      created: moment().format(TIME_FORMAT),
    });
    // only a held lock : not a free row, not a release that is already there
    const res = await mysql.do(
      "UPDATE AnsibleForms.`designer_lock` SET data=?, created=NOW() WHERE id=? AND NOT (" + RELEASED_IS + ")",
      [record, LOCK_ID]);
    if (!res.affectedRows) return { message: 'Lock not present', deleted: false };
    logger.notice(`${admin.username} released the designer lock of ${holder?.username}`);
    // every open designer and header learns it is free, its former holder by whom
    publish("designer");
    return { message: 'Lock deleted' };
  }
  logger.error("Designer is disabled, can't release lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};

/**
 * Marks the lock seen : its holder asked for it. Written at most every SEEN_EVERY_SECONDS, only
 * while the lock is still theirs.
 *
 * Args:
 *   user (object): the holder.
 *   lock (object): the lock as read.
 */
Lock.markSeen = async function (user, lock) {
  const seen = lastSeen(lock);
  if (seen && moment().diff(seen, 'seconds') < SEEN_EVERY_SECONDS) return;
  const data = JSON.stringify({ ...lock, seen: moment().format(TIME_FORMAT) });
  try {
    await mysql.do("UPDATE AnsibleForms.`designer_lock` SET data=? WHERE id=? AND " + HOLDER_IS, [data, LOCK_ID, user.username, user.type]);
  } catch (e) {
    logger.warning(`Could not mark the designer lock seen: ${e.message || e}`);
  }
};

// the lock as yaml text, empty when free (withRelease : as Lock.read)
Lock.get = async function (user={}, { withRelease = false } = {}) {
  if (config.showDesigner && user.options.showDesigner) {
    const lock = await Lock.read({ withRelease });
    return lock === null ? "" : yaml.stringify(lock);
  }
  logger.error("Designer is disabled, can't get lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};

export default  Lock;
