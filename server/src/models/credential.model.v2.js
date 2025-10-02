import CrudModel from './crud.model.js';
import Errors from '../lib/errors.js';
import logger from '../lib/logger.js';
import mysql from './db.model.js';
import crypto from '../lib/crypto.js';

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
  static async findByName(name) {
    return super.findByName(this.modelName, name);
  }

  // Special: regex/fallback search (was findByName in v1)
  static async findByNameRegex(name, fallbackName = "") {
    logger.debug(`Finding credential by regex: ${name}`);
    let cred = null;
    const cache = this.getCache(this.modelName);
    if (cache) cred = cache.get(name);
    if (!cred) {
      let result;
      const sql = "SELECT host,port,db_name,name,user,password,secure,db_type,is_database FROM AnsibleForms.`credentials` WHERE name REGEXP ?";
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
        try {
          result.password = crypto.decrypt(result.password);
        } catch (e) {
          logger.error("Failed to decrypt the password.  Did the secretkey change ?");
          result.password = "";
        }
        if (cache) cache.set(name, result);
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
