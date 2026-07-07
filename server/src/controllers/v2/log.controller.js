'use strict';
import Log from '../../models/log.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';

const get = async function(req, res) {
  try {
    const lines = req.query.lines || 100;
    const log = await Log.find(lines);
    res.json(RestResult.single(log));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedGetLog'), err.toString()));
  }
};

const download = function(req, res) {
  try {
    const file = Log.getFileName();
    res.download(file);
  } catch(err) {
    res.status(404).json(RestResult.error(i18n.t(req, 'resources.logNotFound'), err.toString()));
  }
};

export default {
  get,
  download
};