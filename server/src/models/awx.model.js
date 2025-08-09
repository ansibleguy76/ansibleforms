'use strict';
import https from 'https';
import axios from 'axios';
import logger from '../lib/logger.js';
import mysql from './db.model.js';
import crypto from '../lib/crypto.js';
import NodeCache from 'node-cache';
import appConfig from '../../config/app.config.js';

// we store the awx config for 1 hour (no need to go to database each time)
const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})
function getHttpsAgent(awxConfig){
  // logger.debug("config : " + awxConfig)
  return new https.Agent({
    rejectUnauthorized: !awxConfig.ignore_certs,
    ca: awxConfig.ca_bundle
  })
}

// constructor for awx config
class Awx {
  constructor(awx) {
    if (awx.name !== undefined) this.name = awx.name;
    if (awx.description !== undefined) this.description = awx.description;
    if (awx.is_default !== undefined) this.is_default = awx.is_default ? 1 : 0;
    if (awx.uri !== undefined) this.uri = awx.uri;
    if (awx.use_credentials !== undefined) this.use_credentials = awx.use_credentials ? 1 : 0;
    if (awx.username !== undefined) this.username = awx.username;
    if (awx.password !== undefined) this.password = crypto.encrypt(awx.password);
    if (awx.token !== undefined) this.token = crypto.encrypt(awx.token);
    if (awx.ignore_certs !== undefined) this.ignore_certs = awx.ignore_certs ? 1 : 0;
    if (awx.ca_bundle !== undefined) this.ca_bundle = awx.ca_bundle;
  }
  // get the awx config from cache or database (=wrapper function)
  static async getConfig(name = "") {
    logger.debug(`Getting AWX config for name: ${name}`);
    const cacheKey = `awxConfig:${name || "default"}`;
    let awxConfig = cache.get(cacheKey);
    if (awxConfig === undefined) {
      awxConfig = await Awx.findByName(name);
      cache.set(cacheKey, awxConfig);
      return awxConfig;
    } else {
      logger.debug(`Getting awxConfig for '${name}' from cache`);
      return awxConfig;
    }
  }
  static async delete(id) {
    logger.info(`Deleting AWX config with id ${id}`);
    const res = await mysql.do("DELETE FROM AnsibleForms.`awx` WHERE id = ?", [id]);
    cache.del("awxConfig");
    return true;
  }
  static async create(record) {
    if (!record.name) {
      throw new Error("Name is required");
    }
    logger.info(`Creating AWX config ${record.name}`);
    // Encrypt sensitive fields before saving
    if (!record.password) {
      record.password = "";
    }

    if (!record.token) {
      record.token = "";
    }
    if (record.is_default) {
      await Awx.unsetDefault();
    }
    const res = await mysql.do("INSERT INTO AnsibleForms.`awx` set ?", record);
    cache.del("awxConfig");
    return res.insertId;
  }
  static async unsetDefault() {
    logger.info("Setting is_default=0 on all AWX records");
    await mysql.do("UPDATE AnsibleForms.`awx` SET is_default = 0");
    cache.del("awxConfig");
    return true;
  }
  static async update(record, id = 1) {
    // Find the existing record to get the name (if needed)
    const existing = await Awx.findById(id);
    record.name = existing.name;
    logger.info(`Updating awx ${record.name}`);
    if (record.is_default) {
      await Awx.unsetDefault();
    }
    await mysql.do("UPDATE AnsibleForms.`awx` set ? WHERE id = ?", [record, id]);
    cache.del("awxConfig");
    return record;
  }
  static async find() {
    const result = await mysql.do("SELECT * FROM AnsibleForms.`awx` limit 1;");
    if (result.length > 0) {
      try {
        result[0].token = crypto.decrypt(result[0].token);
      } catch (e) {
        // logger.error("Couldn't decrypt awx token, did the secretkey change ?")
        result[0].token = "";
      }
      try {
        result[0].password = crypto.decrypt(result[0].password);
      } catch (e) {
        // logger.error("Couldn't decrypt awx token, did the secretkey change ?")
        result[0].password = "";
      }
      return result[0];
    } else {
      logger.error("No awx record in the database, something is wrong");
      throw "No awx record in the database, something is wrong";
    }
  }
  static getAuthorization(awxConfig, encrypted = false) {
    var axiosConfig = {};
    if (awxConfig.use_credentials) {
      // logger.debug('Using credentials and basic authentication')
      var upw = `${awxConfig.username}:${(encrypted) ? crypto.decrypt(awxConfig.password) : awxConfig.password}`;
      axiosConfig = {
        headers: {
          Authorization: `Basic ${Buffer.from(upw).toString('base64')}`
        },
        httpsAgent: getHttpsAgent(awxConfig)
      };
    } else {
      // logger.debug('Using token')
      axiosConfig = {
        headers: {
          Authorization: `Bearer ${(encrypted) ? crypto.decrypt(awxConfig.token) : awxConfig.token}`
        },
        httpsAgent: getHttpsAgent(awxConfig)
      };
    }
    return axiosConfig;
  }
  static async check(awxConfig) {
    // this awxConfig comes from the client, not from the database
    // add the api prefix to the uri 
    awxConfig.uri = `${awxConfig.uri}${appConfig.awxApiPrefix}`;
    logger.info(`Checking AWX connection at ${awxConfig.uri}`);
    const axiosConfig = Awx.getAuthorization(awxConfig, true);
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
  static async checkDecrypted(awxConfig) {
    // this awxConfig comes from the client, not from the database
    // add the api prefix to the uri 
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
  static async findAll() {
    logger.info("Finding all AWX records");
    const sql = "SELECT id, name, description, uri, use_credentials, username, password, token, ignore_certs, ca_bundle, is_default FROM AnsibleForms.`awx`;";
    const res = await mysql.do(sql, undefined, true);
    // Decrypt sensitive fields
    return res.map(record => {
      if (record.password) {
        try {
          record.password = crypto.decrypt(record.password);
        } catch (e) {
          logger.error("Failed to decrypt AWX password. Did the secretkey change?");
          record.password = "";
        }
      }
      if (record.token) {
        try {
          record.token = crypto.decrypt(record.token);
        } catch (e) {
          logger.error("Failed to decrypt AWX token. Did the secretkey change?");
          record.token = "";
        }
      }
      return record;
    });
  }

  static async findById(id) {
    logger.info(`Finding AWX by id ${id}`);
    const sql = "SELECT * FROM AnsibleForms.`awx` WHERE id = ?;";
    const res = await mysql.do(sql, id);
    if (res.length > 0) {
      let record = res[0];
      if (record.password) {
        try {
          record.password = crypto.decrypt(record.password);
        } catch (e) {
          logger.error("Failed to decrypt AWX password. Did the secretkey change?");
          record.password = "";
        }
      }
      if (record.token) {
        try {
          record.token = crypto.decrypt(record.token);
        } catch (e) {
          logger.error("Failed to decrypt AWX token. Did the secretkey change?");
          record.token = "";
        }
      }
      return record;
    } else {
      throw new Error(`No AWX record found with id ${id}`);
    }
  }

  static async findByName(name) {
    let sql, param;
    if (!name) {
      sql = "SELECT * FROM AnsibleForms.`awx` WHERE is_default = 1;";
      param = [];
    } else {
      sql = "SELECT * FROM AnsibleForms.`awx` WHERE name = ?;";
      param = [name];
    }
    const res = await mysql.do(sql, param);
    if (res.length > 0) {
      let record = res[0];
      if (record.password) {
        try {
          record.password = crypto.decrypt(record.password);
        } catch (e) {
          logger.error("Failed to decrypt AWX password. Did the secretkey change?");
          record.password = "";
        }
      }
      if (record.token) {
        try {
          record.token = crypto.decrypt(record.token);
        } catch (e) {
          logger.error("Failed to decrypt AWX token. Did the secretkey change?");
          record.token = "";
        }
      }
      return record;
    } else {
      throw new Error(`No AWX record found with name ${name} and no default found`);
    }
  }
}



export default Awx;
