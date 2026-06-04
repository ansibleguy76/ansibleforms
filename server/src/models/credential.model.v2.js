import CrudModel from './crud.model.js';
import Errors from '../lib/errors.js';
import logger from '../lib/logger.js';
import mysql from './db.model.js';
import crypto from '../lib/crypto.js';
import { vaultRead, mapVaultPayloadToCredential } from '../lib/vault.js';

class CredentialModel extends CrudModel {
  static modelName = 'credential';

  static async create(data) {
    return super.create(this.modelName, data);
  }

  static async update(data, id) {
    return super.update(this.modelName, data, id);
  }

  static async delete(id) {
    return super.delete(this.modelName, id);
  }

  static async findAll() {
    return super.findAll(this.modelName);
  }

  static async findById(id) {
    return super.findById(this.modelName, id);
  }

  // Standard findByName (exact match, used by CrudModel)
  // Resolves user/password from HashiCorp Vault if vault_path is set on the row.
  static async findByName(name) {
    const result = await super.findByName(this.modelName, name);
    if (!result) return result;
    if (result.vault_path) {
      try {
        const payload = await vaultRead(result.vault_path);
        const mapped = mapVaultPayloadToCredential(payload);
        result.user = mapped.user || result.user || "";
        result.password = mapped.password || "";
      } catch (e) {
        logger.error(`Failed to read credential '${result.name}' from Vault: ${e.message}`);
        throw e;
      }
      // Bypass the long-lived CrudModel cache for vault-backed creds so
      // password rotations are picked up promptly. The vault lib has its
      // own (shorter) cache.
      const cache = this.getCache(this.modelName);
      if (cache) cache.del(`name:${name}`);
    }
    delete result.vault_path;
    return result;
  }

  // Special: regex/fallback search (was findByName in v1)
  static async findByNameRegex(name, fallbackName = "") {
    logger.debug(`Finding credential by regex: ${name}`);
    let cred = null;
    const cache = this.getCache(this.modelName);
    if (cache) cred = cache.get(name);
    if (!cred) {
      let result;
      const sql = "SELECT host,port,db_name,name,user,password,secure,db_type,is_database,vault_path FROM AnsibleForms.`credentials` WHERE name REGEXP ?";
      let res = await mysql.do(sql, name);
      if (res.length > 0) {
        result = res[0];
      } else if (fallbackName) {
        res = await mysql.do(sql, fallbackName);
        if (res.length > 0) {
          result = res[0];
        }
      }
      if (result) {
        if (result.is_database) {
          result.multipleStatements = true;
        } else {
          delete result.secure;
          delete result.db_name;
          delete result.db_type;
          delete result.is_database;
        }
        // If a vault_path is configured, fetch user/password from HashiCorp Vault.
        // Non-secret connection metadata (host, port, db_name, db_type, secure,
        // is_database) stays in the DB row.
        if (result.vault_path) {
          try {
            const payload = await vaultRead(result.vault_path);
            const mapped = mapVaultPayloadToCredential(payload);
            result.user = mapped.user || result.user || "";
            result.password = mapped.password || "";
          } catch (e) {
            logger.error(`Failed to read credential '${result.name}' from Vault: ${e.message}`);
            throw e;
          }
        } else {
          try {
            result.password = crypto.decrypt(result.password);
          } catch (e) {
            logger.error("Failed to decrypt the password.  Did the secretkey change ?");
            result.password = "";
          }
        }
        const wasVaultBacked = !!result.vault_path;
        delete result.vault_path;
        // Skip the long-lived CrudModel cache for vault-backed credentials so
        // password rotations are picked up promptly (vault lib has its own
        // shorter cache).
        if (cache && !wasVaultBacked) cache.set(name, result);
        logger.debug("Caching credentials " + name + " from database");
        return JSON.parse(JSON.stringify(result));
      } else {
        throw new Errors.NotFoundError("No credential found with filter " + name);
      }
    } else {
      return cred;
    }
  }
}

export default CredentialModel;
