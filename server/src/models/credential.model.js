'use strict';
import logger from "../lib/logger.js";
import Errors from "../lib/errors.js";
import mysql from "./db.model.js";
import crypto from "../lib/crypto.js";
import NodeCache from "node-cache";
import { vaultRead, mapVaultPayloadToCredential } from "../lib/vault.js";

const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});


// Credentials flagged `managed` come from the declarative config seed and are read
// only. This v1 model writes its own SQL, so it does not pass through CrudModel's
// guard and has to ask separately - the seed itself applies through the v2 model.
//
// Every failure in the v1 credential controller answers HTTP 200 with an error body
// (its long-standing behaviour, not changed here), so what this achieves is refusing
// the write, not the status code. The v2 API is the one the client uses, and there
// AccessDeniedError becomes a proper 403.
async function assertNotManaged(id) {
  const res = await mysql.do("SELECT managed FROM AnsibleForms.`credentials` WHERE id = ?", [id]);
  if (res.length && res[0].managed) {
    // a typed error, so the controller can answer 403 rather than a bare 500 - this used
    // to be a plain string and the v1 controller had no status mapping at all
    throw new Errors.AccessDeniedError("This credential is managed by the config seed and is read only");
  }
}

//credential object create
class Credential {
  constructor(credential) {
    if (credential.name != undefined) { this.name = credential.name; }
    if (credential.host != undefined) { this.host = credential.host; }
    if (credential.port != undefined) { this.port = credential.port; }
    if (credential.user != undefined) { this.user = credential.user; }
    if (credential.db_name != undefined) { this.db_name = credential.db_name; }
    if (credential.secure != undefined) { this.secure = (credential.secure) ? 1 : 0; }
    if (credential.is_database != undefined) { this.is_database = (credential.is_database) ? 1 : 0; }
    if (credential.password != undefined) { this.password = crypto.encrypt(credential.password); }
    if (credential.description != undefined) { this.description = credential.description; }
    if (credential.db_type != undefined) { this.db_type = credential.db_type; }
    if (credential.vault_path != undefined) { this.vault_path = credential.vault_path || null; }
  }
  static async create(record) {
    if (!record.name) {
      throw "Name is required";
    }
    logger.info(`Creating credential ${record.name}`);
    var res = await mysql.do("INSERT INTO AnsibleForms.`credentials` set ?", record);
    return res.insertId;
  }
  static async update(record, id) {
    const r = await Credential.findById(id); // quickly search name
    record.name = r[0].name;
    await assertNotManaged(id);
    logger.info(`Updating credential ${record.name}`);
    var res = await mysql.do("UPDATE AnsibleForms.`credentials` set ? WHERE id=?", [record, id]);
    cache.del(record.name);
    return res;
  }
  static async delete(id) {
    await assertNotManaged(id);
    logger.info(`Deleting credential ${id}`);
    var res = await mysql.do("DELETE FROM AnsibleForms.`credentials` WHERE id = ? AND name<>'admins'", [id]);
    return res;
  }
  static async findAll() {
    logger.info("Finding all credentials");
    var res = await mysql.do("SELECT id,name,user,host,port,description,secure,db_type,db_name,is_database FROM AnsibleForms.`credentials`;");
    return res;
  }
  static findById(id) {
    logger.info(`Finding credential ${id}`);
    return mysql.do("SELECT * FROM AnsibleForms.`credentials` WHERE id=?;", id)
      .then((res) => {
        if (res.length > 0) {
          try {
            res[0].password = crypto.decrypt(res[0].password);
          } catch (e) {
            logger.error("Failed to decrypt the password.  Did the secretkey change ?");
            res[0].password = "";
          }
          return res;
        } else {
          throw `No credential found with id ${id}`;
        }
      });
  }
  static findByName2(name) {
    logger.info(`Finding credential ${name}`);
    return mysql.do("SELECT * FROM AnsibleForms.`credentials` WHERE name=?;", name)
      .then((res) => {
        if (res.length > 0) {
          try {
            res[0].password = crypto.decrypt(res[0].password);
          } catch (e) {
            logger.error("Failed to decrypt the password.  Did the secretkey change ?");
            res[0].password = "";
          }
          return res;
        } else {
          throw `No credential found named ${name}`;
        }
      });
  }
  static async findByName(name, fallbackName = "") {
    logger.debug(`Finding credential ${name}`);
    var cred = cache.get(name);

    if (cred === undefined) {
      var result;
      var sql = "SELECT host,port,db_name,name,user,password,secure,db_type,is_database,vault_path FROM AnsibleForms.`credentials` WHERE name REGEXP ?";
      var res = await mysql.do(sql, name);
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
        // If vault_path is configured, resolve user/password from HashiCorp Vault.
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
        // Skip the long-lived NodeCache for vault-backed creds; the vault lib
        // has its own shorter cache to pick up rotations.
        if (!wasVaultBacked) cache.set(name, result);
        logger.debug("Caching credentials " + name + " from database");
        return JSON.parse(JSON.stringify(result));
      } else {
        throw new Error("No credential found with filter " + name);
      }

    } else {
      // logger.debug("returning credentials " + name + " from cache")
      return cred;
    }
  }
}


export default Credential;
