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

// the lock as stored, or null when free ; no designer check, for the background jobs and the
// Status page. A lock left behind (not seen for LOCK_STALE_SECONDS) is released here : only
// while it is still the row read, so a holder who comes back at that moment keeps it.
Lock.read = async function(){
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
      logger.notice(`Released the designer lock of ${lock.username}, not seen since ${seen.format(TIME_FORMAT)}`);
      // every open designer and header learns it is free (lib/liveEvents.js)
      publish("designer");
      return null;
    }
    // changed meanwhile (its holder came back) : what is there now, as it is - read once more,
    // never in a loop
    const again = await mysql.do("SELECT data FROM AnsibleForms.`designer_lock` WHERE id=?", [LOCK_ID], true);
    if (!again?.length || !again[0].data) return null;
    try {
      return JSON.parse(again[0].data);
    } catch {
      return {};
    }
  }
  return lock;
};
// lightweight check : is the designer lock currently held by anyone ? used by
// background jobs (cron pull) to avoid running git on a working tree while the
// designer is editing it, even before the first save makes the tree dirty
// (issue #414)
Lock.isHeld = async function(){
  try {
    return (await Lock.read()) !== null;
  } catch (e) {
    logger.warning(`Could not read the designer lock : ${e.message || e}`);
    return false;
  }
};
Lock.status = async function(user){
  const lck = yaml.parse(await Lock.get(user) || "null");
  if (!lck) return { free: true };
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
      const refreshed = await mysql.do(
        "UPDATE AnsibleForms.`designer_lock` SET data=?, created=NOW() WHERE id=? AND " + HOLDER_IS,
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
      logger.warning(`Failed to refresh the forms repositories : ${e.message}`);
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
    logger.warning(`Could not mark the designer lock seen : ${e.message || e}`);
  }
};

// the lock as yaml text, empty when free
Lock.get = async function (user={}) {
  if (config.showDesigner && user.options.showDesigner) {
    const lock = await Lock.read();
    return lock === null ? "" : yaml.stringify(lock);
  }
  logger.error("Designer is disabled, can't get lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};

export default  Lock;
