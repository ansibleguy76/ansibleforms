
import https from 'https';
import axios from 'axios';
import logger from '../lib/logger.js';
import mysql from './db.model.js';
import crypto from '../lib/crypto.js';
import appConfig from '../../config/app.config.js';
import CrudModel from './crud.model.js';

function getHttpsAgent(awxConfig) {
  return new https.Agent({
    rejectUnauthorized: !awxConfig.ignore_certs,
    ca: awxConfig.ca_bundle
  });
}

class Awx extends CrudModel {
  static modelName = 'awx';

  // Custom preProcess for AWX: unset other defaults if is_default is set
  static async preProcess(data, action) {
    if (data.is_default) {
      logger.info('Unsetting is_default on all other AWX records');
      await mysql.do('UPDATE AnsibleForms.`awx` SET is_default = 0');
      // Flush CrudModel cache for awx
      const cache = this.getCache(this.modelName);
      if (cache) cache.flushAll();
    }
    return data;
  }

  // Proxy CRUD methods to CrudModel, injecting custom preProcess
  static async create(data) {
    data = await this.preProcess(data, 'create');
    return super.create(this.modelName, data);
  }
  static async update(data, id) {
    data = await this.preProcess(data, 'update');
    return super.update(this.modelName, data, id);
  }
  static async delete(id) {
    return super.delete(this.modelName, id);
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
    let axiosConfig = {};
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
