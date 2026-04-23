'use strict';
import CrudModel from './crud.model.js';

class Group extends CrudModel {
    static modelName = 'groups';

    static async create(data) {
        return super.create(this.modelName, data);
    }
    static async update(data, id) {
        // Prevent modification of admins group - check by name, not ID
        const group = await super.findById(this.modelName, id);
        if (group && group.name === 'admins') {
            throw new Error("You cannot modify group 'admins'");
        }
        return super.update(this.modelName, data, id);
    }
    static async delete(id) {
        // Prevent deletion of admins group - check by name, not ID
        const group = await super.findById(this.modelName, id);
        if (group && group.name === 'admins') {
            throw new Error("You cannot delete group 'admins'");
        }
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
}

export default Group;
