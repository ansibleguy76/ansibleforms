'use strict';
import RestResult from '../../models/restResult.model.v2.js';
import Lock from '../../models/lock.model.js';
import Errors from '../../lib/errors.js';
import i18n from '../../lib/i18n.js';
import logger from '../../lib/logger.js';

// The lock (a database row) is a copy of the user who took the lock : their roles, groups, options
// and email as well as their name. The status goes to every designer user, who only needs
// to see who holds it and since when - the rest stays on the server.
const LOCK_FIELDS = ['username', 'type', 'displayName', 'created'];

/**
 * Keeps the fields of a lock holder that the status may show.
 *
 * Args:
 *   lock (object): the lock as stored, a copy of the user who took it.
 *
 * Returns:
 *   object: the holder's username, login type, display name and when the lock was taken.
 */
function publicLock(lock) {
  return Object.fromEntries(LOCK_FIELDS.filter((k) => lock?.[k] !== undefined).map((k) => [k, lock[k]]));
}

// Follow knownhosts style: minimal validation, try/catch, RestResult.list/single/error
const lockController = {
  async status(req, res) {
    try {
      const result = await Lock.status(req.user.user);
      if (result.lock) result.lock = publicLock(result.lock);
      return res.json(RestResult.single(result));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async set(req, res) {
    try {
      await Lock.set(req.user.user);
      return res.status(201).json(RestResult.single({ message: i18n.t(req, 'resources.lockAdded') }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async delete(req, res) {
    try {
      const current = await Lock.status(req.user.user);
      // an admin releases somebody else's lock (?force=true) : a lock its holder cannot release
      // any more (gone, or away) ; their unsaved changes are lost
      if (req.query?.force === 'true') {
        // an admin : as lib/adminGrants.js isAdminRequest (not imported : it loads the database)
        if (!(req.user.user.roles || []).includes('admin')) throw new Errors.AccessDeniedError(i18n.t(req, 'errors.notAdmin'));
        if (!current.free) {
          logger.notice(`${req.user.user.username} released the designer lock of ${current.lock?.username}`);
          await Lock.delete(req.user.user);
        }
        return res.json(RestResult.single({ message: i18n.t(req, 'resources.lockDeleted') }));
      }
      // only its holder turns the designer off : somebody else's lock is theirs until they do
      if (!current.free && !current.match) {
        throw new Errors.ApiError(`The designer is locked by ${current.lock?.username || 'another user'}`, 423);
      }
      await Lock.delete(req.user.user, { onlyMine: true });
      return res.json(RestResult.single({ message: i18n.t(req, 'resources.lockDeleted') }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default lockController;