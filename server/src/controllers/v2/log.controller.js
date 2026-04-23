'use strict';
import Log from '../../models/log.model.js';
import RestResult from '../../models/restResult.model.v2.js';

const get = async function(req, res) {
  try {
    const lines = req.query.lines || 100;
    const log = await Log.find(lines);
    res.json(RestResult.single(log));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to get log", err.toString()));
  }
};

const download = function(req, res) {
  try {
    const file = Log.getFileName();
    res.download(file);
  } catch(err) {
    res.status(404).json(RestResult.error("Log file not found", err.toString()));
  }
};

export default {
  get,
  download
};