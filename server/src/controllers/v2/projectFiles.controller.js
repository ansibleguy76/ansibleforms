'use strict';
// The designer's Playbooks and Vars files sections (models/projectFiles.model.js) : reading is
// open to every designer user, a change (save, new file, delete, push) only to the one holding
// the designer lock - as a change of the forms.
import RestResult from '../../models/restResult.model.v2.js';
import ProjectFiles from '../../models/projectFiles.model.js';
import Lock from '../../models/lock.model.js';
import Errors from '../../lib/errors.js';
import i18n from '../../lib/i18n.js';

/**
 * Answers 423 (and returns false) unless the caller holds the designer lock.
 *
 * Args:
 *   req (object): the request.
 *   res (object): the response.
 *
 * Returns:
 *   boolean: true when the caller may change the files.
 */
async function holdsLock(req, res) {
  const lock = await Lock.status(req.user.user);
  if (lock.match) return true;
  res.status(423).json(
    RestResult.error(
      i18n.t(req, 'config.designerLocked'),
      lock.free ? 'Start the designer first' : i18n.t(req, 'config.designerLockedBy', { username: lock.lock.username }),
    ),
  );
  return false;
}

const projectFilesController = {
  async list(req, res) {
    try {
      res.json(RestResult.single(await ProjectFiles.list(req.params.kind)));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async read(req, res) {
    try {
      res.json(RestResult.single(await ProjectFiles.read(req.params.kind, req.query.path)));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async save(req, res) {
    try {
      if (!(await holdsLock(req, res))) return;
      res.json(RestResult.single(await ProjectFiles.write(req.params.kind, req.body?.path, req.body?.content)));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async create(req, res) {
    try {
      if (!(await holdsLock(req, res))) return;
      res.status(201).json(RestResult.single(await ProjectFiles.write(req.params.kind, req.body?.path, req.body?.content ?? '', true)));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async remove(req, res) {
    try {
      if (!(await holdsLock(req, res))) return;
      res.json(RestResult.single(await ProjectFiles.remove(req.params.kind, req.query.path)));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async push(req, res) {
    try {
      if (!(await holdsLock(req, res))) return;
      res.json(RestResult.single(await ProjectFiles.push(req.params.kind, req.user.user.username)));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
};

export default projectFilesController;
