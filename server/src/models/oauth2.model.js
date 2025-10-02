
import CrudModel from './crud.model.js';
import mysql from './db.model.js';
import logger from '../lib/logger.js';

class OAuth2 extends CrudModel {
    static modelName = 'oauth2';

    // Custom preProcess for AWX: unset other defaults if enable is set
    static async preProcess(data, action) {
        if (data.enable) {
            logger.info('Unsetting enable on all other OAuth2 records');
            await mysql.do('UPDATE AnsibleForms.`oauth2_providers` SET enable = 0 WHERE provider = ?', [data.provider]);
        }
        return data;
    }
    static async create(data) {
        data =await this.preProcess(data, 'create');
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
}

export default OAuth2;
