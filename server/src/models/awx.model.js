
import https from 'https';
import axios from 'axios';
import logger from '../lib/logger.js';
import mysql from './db.model.js';
import crypto from '../lib/crypto.js';
import appConfig from '../../config/app.config.js';
import CrudModel from './crud.model.js';
import Errors from '../lib/errors.js';

function getHttpsAgent(awxConfig) {
  return new https.Agent({
    rejectUnauthorized: !awxConfig.ignore_certs,
    ca: awxConfig.ca_bundle
  });
}

class Awx extends CrudModel {
  static modelName = 'awx';

  // Custom preProcess for AWX: unset other defaults if is_default is set
  //
  // This WRITES, and it runs before the required-field check and before the managed
  // guard, so it used to mutate the database on requests that were then refused: a
  // `POST` missing `name` answered 400 and a `PUT` on a seeded row answered 403, but
  // both had already cleared is_default on every row - including the seed-managed one,
  // leaving the instance with no default AAP until the next restart re-applied it.
  // Worse, an unmanaged row could take the default away from a managed one.
  //
  // Two changes: the blanket update never touches a managed row, and a caller trying
  // to take the default away from one is refused rather than silently ignored.
  static async preProcess(data, _action, opts = {}) {
    if (data.is_default) {
      if (!opts.fromSeed) {
        const held = await mysql.do('SELECT name FROM AnsibleForms.`awx` WHERE is_default = 1 AND managed = 1');
        if (held.length) {
          throw new Errors.AccessDeniedError(`The default AWX/AAP connection is managed by the config seed ('${held[0].name}') and cannot be changed here`);
        }
      }
    }
    return data;
  }

  /**
   * Clear is_default on every OTHER record, once this one is safely stored.
   *
   * This used to run inside preProcess, i.e. BEFORE the insert or update it belongs to -
   * and that write can fail: `name` carries a unique key
   * (uk_AnsibleForms_awx_natural_key), so creating a connection whose name already exists
   * cleared the flag on every unmanaged row and then died with ER_DUP_ENTRY. No record
   * was created AND the instance was left with no default AWX/AAP at all, so every job
   * targeting the default failed until someone set it again by hand. Any other insert
   * failure (an over-long uri in strict mode) did the same.
   *
   * Running it afterwards makes the pair safe without a transaction: if the row is not
   * stored, nothing else is touched.
   *
   * The seed clears EVERY row (it owns the managed ones, and must be able to move the
   * flag between two of them or the previous holder keeps it for ever). An API caller
   * clears only unmanaged rows - it was already refused in preProcess if a managed row
   * holds the default.
   */
  static async clearOtherDefaults(keepId, opts = {}) {
    logger.info('Unsetting is_default on all other AWX records');
    const scope = opts.fromSeed ? '' : ' AND managed = 0';
    await mysql.do('UPDATE AnsibleForms.`awx` SET is_default = 0 WHERE id <> ?' + scope, [keepId]);
    // Flush CrudModel cache for awx
    const cache = this.getCache(this.modelName);
    if (cache) cache.flushAll();
  }

  // Proxy CRUD methods to CrudModel, injecting custom preProcess
  // opts carries { fromSeed:true } for the declarative config seed only, which is
  // what lets it write records the API is refused on. See lib/seed.js.
  // Everything that can REFUSE the request runs before preProcess, because preProcess
  // writes to other rows. checkExist and the required-field check live inside
  // CrudModel.create/update, i.e. after it - so they have to be asked for up front too.
  static async create(data, opts = {}) {
    CrudModel.assertRequired(this.modelName, data);
    // preProcess only REFUSES now ; the write it used to do happens after the insert
    data = await this.preProcess(data, 'create', opts);
    const insertId = await super.create(this.modelName, data, opts);
    if (data.is_default && insertId) await this.clearOtherDefaults(insertId, opts);
    return insertId;
  }
  static async update(data, id, opts = {}) {
    await CrudModel.checkExist(this.modelName, id);
    if (!opts.fromSeed) await CrudModel.assertNotManaged(this.modelName, id);
    data = await this.preProcess(data, 'update', opts);
    const res = await super.update(this.modelName, data, id, opts);
    if (data.is_default) await this.clearOtherDefaults(id, opts);
    return res;
  }
  static async delete(id, opts = {}) {
    return super.delete(this.modelName, id, opts);
  }
  static async findById(id) {
    return super.findById(this.modelName, id);
  }
  static async findAll() {
    return super.findAll(this.modelName);
  }
  static async findByName(name) {
    return super.findByName(this.modelName, name);
  }
  static async findByProperty(property, value) {
    return super.findByProperty(this.modelName, property, value);
  }

  // AWX-specific logic
  static getAuthorization(awxConfig, encrypted = false) {
    let axiosConfig;
    if (awxConfig.use_credentials) {
      let upw = `${awxConfig.username}:${encrypted ? crypto.decrypt(awxConfig.password) : awxConfig.password}`;
      axiosConfig = {
        headers: {
          Authorization: `Basic ${Buffer.from(upw).toString('base64')}`
        },
        httpsAgent: getHttpsAgent(awxConfig)
      };
    } else {
      axiosConfig = {
        headers: {
          Authorization: `Bearer ${encrypted ? crypto.decrypt(awxConfig.token) : awxConfig.token}`
        },
        httpsAgent: getHttpsAgent(awxConfig)
      };
    }
    return axiosConfig;
  }

  static async check(awxConfig) {
    awxConfig.uri = `${awxConfig.uri}${appConfig.awxApiPrefix}`;
    logger.info(`Checking AWX connection at ${awxConfig.uri}`);
    const axiosConfig = Awx.getAuthorization(awxConfig, false);
    try {
      const axiosresult = await axios.get(awxConfig.uri + "/job_templates/", axiosConfig);
      if (axiosresult?.data?.results) {
        return "Awx Connection is OK";
      } else {
        throw new Error("Awx Connection failed");
      }
    } catch (e) {
      logger.error("Error while checking AWX connection", e);
      throw e;
    }
  }
}

export default Awx;
