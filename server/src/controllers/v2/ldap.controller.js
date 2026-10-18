'use strict';
// /api/v2/ldap : the default LDAP directory, as before there were several (the directories are
// /api/v2/ldapdirectory, ldapDirectory.controller.js). Each request is handed to the directory's
// own handler for the default directory : one set of rules (the masked password, the seed's
// directory read only, the stored password only for the stored servers), never two that drift.
import Ldap from '../../models/ldap.model.js';
import Errors from '../../lib/errors.js';
import logger from "../../lib/logger.js";
import directoryController, { sameLdapTarget } from './ldapDirectory.controller.js';

// kept here for whoever imported it from this controller before it moved
export { sameLdapTarget };

/**
 * Builds a handler of /api/v2/ldap : the directory handler, run for the default directory (the
 * one named DEFAULT_NAME, else the first : Ldap.find).
 *
 * Args:
 *   handler (function): the ldapDirectory.controller.js handler.
 *
 * Returns:
 *   function: the express handler.
 */
function onDefault(handler) {
  return async function (req, res) {
    let directory;
    try {
      directory = await Ldap.find();
    } catch (err) {
      logger.error("Error finding the default LDAP directory: ", err);
      return Errors.ReturnError(res, new Errors.NotFoundError(String(err?.message || err)));
    }
    req.params = { ...(req.params || {}), id: String(directory.id) };
    return handler(req, res);
  };
}

export default {
  find: onDefault(directoryController.findById),
  check: onDefault(directoryController.check),
  update: onDefault(directoryController.update),
};
