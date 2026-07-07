'use strict';
import multer from 'multer';
import Settings from '../../models/settings.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import logger from '../../lib/logger.js';
import Helpers from '../../lib/common.js';
import i18n from '../../lib/i18n.js';
import { sniffImageMime } from '../../lib/imagetype.js';
import { DEFAULT_LOGO } from '../../lib/defaultlogo.js';

// a logo is small ; cap the upload well below anything that would bloat the settings table
const MAX_LOGO_BYTES = 900 * 1024;

// keep the upload in memory, it is validated and stored in the database as a data url,
// nothing is ever written to disk
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 1 }
});

const get = async function (req, res) {
  try {
    const logo = (await Settings.getLogo()) || DEFAULT_LOGO;
    res.json(RestResult.single({ logo, isDefault: logo === DEFAULT_LOGO }));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindLogo'), Helpers.getError(err)));
  }
};

const update = function (req, res) {
  uploadMulter.single('logo')(req, res, async function (err) {
    if (err) {
      // multer errors, eg file too large
      logger.error(`Logo upload error : ${err.toString()}`)
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.failedUpdateLogo'), err.toString()));
    }
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.failedUpdateLogo'), i18n.t(req, 'resources.logoNoFile')));
    }
    // never trust the declared content type ; sniff the magic bytes
    const mime = sniffImageMime(req.file.buffer);
    if (!mime) {
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.failedUpdateLogo'), i18n.t(req, 'resources.logoInvalidImage')));
    }
    try {
      await Settings.setLogo(`data:${mime};base64,${req.file.buffer.toString('base64')}`);
      logger.notice(`Custom logo updated (${mime}, ${req.file.buffer.length} bytes)`)
      res.json(RestResult.single(null));
    } catch (e) {
      res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedUpdateLogo'), Helpers.getError(e)));
    }
  });
};

const remove = async function (req, res) {
  try {
    await Settings.setLogo(DEFAULT_LOGO);
    logger.notice(`Custom logo removed, default logo restored`)
    res.json(RestResult.single(null));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedUpdateLogo'), Helpers.getError(err)));
  }
};

export default {
  get,
  update,
  remove
};
