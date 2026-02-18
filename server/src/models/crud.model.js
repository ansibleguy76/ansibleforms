import Errors from '../lib/errors.js';
import logger from '../lib/logger.js';
import crypto from '../lib/crypto.js';
import NodeCache from 'node-cache';
import crudConfigs from '../../config/crud.config.js';
import mysql from './db.model.js';

// Per-model cache objects
const caches = {};

class CrudModel {
  static getConfig(modelName) {
    const config = crudConfigs[modelName];
    if (!config) throw new Errors.BadRequestError(`Unknown model: ${modelName}`);
    return config;
  }

  static getCache(modelName) {
    const config = this.getConfig(modelName);
    if (!config.allowCache) return null;
    if (!caches[modelName]) {
      caches[modelName] = new NodeCache({ stdTTL: config.cacheTTL || 3600, checkperiod: (config.cacheTTL || 3600) * 0.5 });
    }
    return caches[modelName];
  }

  static getSelectFields(modelName, { hideHidden = false } = {}) {
    const config = this.getConfig(modelName);
    return config.fields
      .filter(f => !(hideHidden && f.hidden))
      .map(f => f.name)
      .join(', ');
  }

  static getFieldValues(modelName, data, isUpdate=false) {
    const config = this.getConfig(modelName);
    const result = {};
    for (const field of config.fields) {
      if (data[field.name] !== undefined) {
        let value = data[field.name];
        if (field.isEncrypted && value) {
          value = crypto.encrypt(value);
        } else if (field.isBoolean) {
          value = value ? 1 : 0;
        }
        result[field.name] = value;
      }else{
        if(field.setDefault && !isUpdate){ // if not update (create) => set defaults where needed
          // set defaults
          result[field.name] = ''
          if(field.isBoolean){
            result[field.name] = 0
          }
        }
      }
    }
    return result;
  }

  static postProcess(modelName, record) {
    if (!record) return record;
    const config = this.getConfig(modelName);
    for (const field of config.fields) {
      if (field.isEncrypted && record[field.name]) {
        try {
          record[field.name] = crypto.decrypt(record[field.name]);
        } catch (e) {
          logger.error('Failed to decrypt value', e);
          record[field.name] = '';
        }
      }
    }
    return record;
  }

  static async checkExist(modelName, id) {
    
    const config = this.getConfig(modelName);
    const key = config.fields.find(f => f.isKey)?.name || 'id';
    const sql = `SELECT 1 FROM ?? WHERE ?? = ?`;
    const res = await mysql.do(sql, [config.table, key, id]);
    if (!res.length) throw new Errors.NotFoundError(`No record found with ${key} ${id}`);
    return true;
  }

  static async findAll(modelName) {
    const config = this.getConfig(modelName);
    const sql = `SELECT ${this.getSelectFields(modelName, { hideHidden: true })} FROM ${config.table}`;
    const res = await mysql.do(sql);
    return res.map(r => this.postProcess(modelName, r));
  }


  static async findById(modelName, id) {
    const config = this.getConfig(modelName);
    const cache = this.getCache(modelName);
    const key = config.fields.find(f => f.isKey)?.name || 'id';
    if (config.allowCache && cache) {
      const cacheKey = `id:${id}`;
      let cached = cache.get(cacheKey);
      if (cached) return cached;
      await this.checkExist(modelName, id);
      const sql = `SELECT ${this.getSelectFields(modelName)} FROM ${config.table} WHERE ${key} = ?`;
      const res = await mysql.do(sql, [id]);
      const result = res[0] ? this.postProcess(modelName, res[0]) : null;
      if (result) cache.set(cacheKey, result);
      return result;
    } else {
      await this.checkExist(modelName, id);
      const sql = `SELECT ${this.getSelectFields(modelName)} FROM ${config.table} WHERE ${key} = ?`;
      const res = await mysql.do(sql, [id]);
      return res[0] ? this.postProcess(modelName, res[0]) : null;
    }
  }

  static async findByName(modelName, name) {
    const config = this.getConfig(modelName);
    const cache = this.getCache(modelName);
    const naturalKey = config.fields.find(f => f.isNaturalKey)?.name || 'name';
    if (config.allowCache && cache) {
      const cacheKey = `name:${name}`;
      let cached = cache.get(cacheKey);
      if (cached) return cached;
      const sql = `SELECT ${this.getSelectFields(modelName)} FROM ${config.table} WHERE ${naturalKey} = ?`;
      const res = await mysql.do(sql, [name]);
      const result = res[0] ? this.postProcess(modelName, res[0]) : null;
      if (result) cache.set(cacheKey, result);
      return result;
    } else {
      const sql = `SELECT ${this.getSelectFields(modelName)} FROM ${config.table} WHERE ${naturalKey} = ?`;
      const res = await mysql.do(sql, [name]);
      return res[0] ? this.postProcess(modelName, res[0]) : null;
    }
  }

  static async findByProperty(modelName, property, value) {
    if (!property) throw new Errors.BadRequestError('Property name required');
    const config = this.getConfig(modelName);
    const sql = `SELECT ${this.getSelectFields(modelName)} FROM ${config.table} WHERE ${property} = ? LIMIT 1`;
    const res = await mysql.do(sql, [value]);
    return res[0] ? this.postProcess(modelName, res[0]) : null;
  }

  // Hook for custom pre-processing (can be overridden in parent model)
  static async preProcess(modelName, data, action) {
    return data;
  }

  static async create(modelName, data) {
    // data = await this.preProcess(modelName, data, 'create');
    const config = this.getConfig(modelName);
    // Check required fields
    for (const field of config.fields) {
      if (field.required && (data[field.name] === undefined || data[field.name] === null || data[field.name] === '')) {
        throw new Errors.BadRequestError(`Missing required field: ${field.name}`);
      }
    }
    const fieldValues = this.getFieldValues(modelName, data);
    const sql = `INSERT INTO ${config.table} SET ?`;
    const res = await mysql.do(sql, fieldValues);
    // No cache flush needed on create; new record isn't cached yet
    return res.insertId || null;
  }

  static async update(modelName, data, id) {
    // data = await this.preProcess(modelName, data, 'update');
    const config = this.getConfig(modelName);
    const cache = this.getCache(modelName);
    const key = config.fields.find(f => f.isKey)?.name || 'id';
    await this.checkExist(modelName, id);
    const fieldValues = this.getFieldValues(modelName, data, true);
    const sql = `UPDATE ${config.table} SET ? WHERE ${key} = ?`;
    const res = await mysql.do(sql, [fieldValues, id]);
    if (config.allowCache && cache) {
      delete caches[modelName]; // clear entire cache for simplicity
      const naturalKey = config.fields.find(f => f.isNaturalKey)?.name || 'name';

    }
    return res.affectedRows > 0;
  }

  static async delete(modelName, id) {
    const config = this.getConfig(modelName);
    const cache = this.getCache(modelName);
    const key = config.fields.find(f => f.isKey)?.name || 'id';
    await this.checkExist(modelName, id);
    // Get the record first to get the name for cache removal
    let record = null;
    if (config.allowCache && cache) {
      // call base implementation directly to avoid subclass overrides with different signatures
      record = await CrudModel.findById(modelName, id);
    }
    const sql = `DELETE FROM ${config.table} WHERE ${key} = ?`;
    const res = await mysql.do(sql, [id]);
    if (config.allowCache && cache) {
      cache.del(`id:${id}`);
      const naturalKey = config.fields.find(f => f.isNaturalKey)?.name || 'name';
      if (record && record[naturalKey]) cache.del(`name:${record[naturalKey]}`);
    }
    return res.affectedRows > 0;
  }
}

export default CrudModel;
