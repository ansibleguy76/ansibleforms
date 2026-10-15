'use strict';
// Settings > Access > LDAP : the directories, each with its own servers, users and groups. The
// default one is also /api/v2/ldap (ldap.controller.js), as before there were several.
import Ldap from '../../models/ldap.model.js';
import RestResultv2 from '../../models/restResult.model.v2.js';
import logger from "../../lib/logger.js";
import i18n from '../../lib/i18n.js';
import { sameLdapTarget } from './ldap.controller.js';

// the bind password as the API shows it : never in clear
const MASK = '**********';

/**
 * A directory as the API shows it : its bind password masked.
 *
 * Args:
 *   directory (object): the directory, its password decrypted.
 *
 * Returns:
 *   object: the directory to send.
 */
function shown(directory) {
  return directory ? { ...directory, bind_user_pw: directory.bind_user_pw ? MASK : '' } : directory;
}

/**
 * Whether a request carried no data.
 *
 * Args:
 *   req (object): the request.
 *
 * Returns:
 *   boolean: true when its body is empty.
 */
const empty = (req) => req.body?.constructor === Object && Object.keys(req.body).length === 0;

const findAll = async function (req, res) {
  try {
    // in the lookup order, the first and the last said (the list's Move up and Move down)
    const all = await Ldap.findAll();
    res.status(200).json(RestResultv2.list(all.map((d, i) => ({ ...shown(d), isFirst: i === 0, isLast: i === all.length - 1 }))));
  } catch (err) {
    logger.error("Error finding the LDAP directories: ", err);
    res.status(500).json(RestResultv2.error(i18n.t(req, 'resources.failedFindLdap'), err.toString()));
  }
};

const findById = async function (req, res) {
  try {
    const directory = await Ldap.findById(req.params.id);
    if (!directory) return res.status(404).json(RestResultv2.error(i18n.t(req, 'resources.failedFindLdap'), `No ldap directory ${req.params.id}`));
    res.status(200).json(RestResultv2.single(shown(directory)));
  } catch (err) {
    logger.error("Error finding the LDAP directory: ", err);
    res.status(500).json(RestResultv2.error(i18n.t(req, 'resources.failedFindLdap'), err.toString()));
  }
};

const create = async function (req, res) {
  if (empty(req)) return res.status(409).json(RestResultv2.error(i18n.t(req, 'errors.noDataSent')));
  try {
    const id = await Ldap.create({ ...new Ldap(req.body), managed: 0 });
    res.status(200).json(RestResultv2.single({ id, message: i18n.t(req, 'resources.ldapCreated') }));
  } catch (err) {
    logger.error("Error adding an LDAP directory: ", err);
    res.status(400).json(RestResultv2.error(i18n.t(req, 'resources.failedCreateLdap'), err.message || err.toString()));
  }
};

const update = async function (req, res) {
  if (empty(req)) return res.status(409).json(RestResultv2.error(i18n.t(req, 'errors.noDataSent')));
  try {
    const existing = await Ldap.findById(req.params.id);
    if (!existing) return res.status(404).json(RestResultv2.error(i18n.t(req, 'resources.failedUpdateLdap'), `No ldap directory ${req.params.id}`));
    // a directory of the config seed is read only here : the seed re-applies on every start
    if (existing.managed) {
      return res.status(403).json(RestResultv2.error(i18n.t(req, 'resources.failedUpdateLdap'), i18n.t(req, 'resources.seedManagedLdap')));
    }
    // the masked password : the stored one kept
    if (req.body.bind_user_pw === MASK) req.body.bind_user_pw = existing.bind_user_pw;
    const record = { ...new Ldap(req.body) };
    delete record.managed;
    await Ldap.updateById(req.params.id, record);
    res.status(200).json(RestResultv2.single({ message: i18n.t(req, 'resources.ldapUpdated') }));
  } catch (err) {
    logger.error("Error updating the LDAP directory: ", err);
    res.status(400).json(RestResultv2.error(i18n.t(req, 'resources.failedUpdateLdap'), err.message || err.toString()));
  }
};

const remove = async function (req, res) {
  try {
    await Ldap.deleteById(req.params.id);
    res.status(200).json(RestResultv2.single({ message: i18n.t(req, 'resources.ldapDeleted') }));
  } catch (err) {
    logger.error("Error deleting the LDAP directory: ", err);
    res.status(400).json(RestResultv2.error(i18n.t(req, 'resources.failedDeleteLdap'), err.message || err.toString()));
  }
};

// one place up or down in the lookup order : { direction: 'up' | 'down' }
const move = async function (req, res) {
  try {
    const moved = await Ldap.move(req.params.id, req.body?.direction);
    res.status(200).json(RestResultv2.single({ moved }));
  } catch (err) {
    logger.error("Error moving the LDAP directory: ", err);
    res.status(400).json(RestResultv2.error(i18n.t(req, 'resources.failedUpdateLdap'), err.message || err.toString()));
  }
};

const check = async function (req, res) {
  if (empty(req)) return res.status(409).json(RestResultv2.error(i18n.t(req, 'errors.noDataSent')));
  try {
    const existing = await Ldap.findById(req.params.id);
    if (!existing) return res.status(404).json(RestResultv2.error(i18n.t(req, 'resources.ldapCheckFailed'), `No ldap directory ${req.params.id}`));
    // the page's fields as they are (saved or not) ; the stored bind password only for the stored
    // servers, never handed to others
    const sent = { ...existing, ...req.body };
    if (sent.bind_user_pw === MASK) {
      if (!sameLdapTarget(sent, existing)) {
        return res.status(400).json(RestResultv2.error(i18n.t(req, 'resources.ldapCheckFailed'), i18n.t(req, 'resources.storedPasswordOtherServer')));
      }
      sent.bind_user_pw = existing.bind_user_pw;
    }
    res.status(200).json(RestResultv2.single(await Ldap.check(new Ldap(sent))));
  } catch (err) {
    logger.error("Error checking the LDAP directory: ", err);
    res.status(500).json(RestResultv2.error(i18n.t(req, 'resources.ldapCheckFailed'), err.message || err.toString()));
  }
};

export default { findAll, findById, create, update, remove, move, check };
