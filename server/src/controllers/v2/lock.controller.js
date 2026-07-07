'use strict';
import RestResult from '../../models/restResult.model.v2.js';
import Lock from '../../models/lock.model.js';
import Errors from '../../lib/errors.js';
import i18n from '../../lib/i18n.js';

// Follow knownhosts style: minimal validation, try/catch, RestResult.list/single/error
const lockController = {
  async status(req, res) {
    try {
      const result = await Lock.status(req.user.user);
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
      await Lock.delete(req.user.user);
      return res.json(RestResult.single({ message: i18n.t(req, 'resources.lockDeleted') }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default lockController;