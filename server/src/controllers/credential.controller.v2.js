import CredentialModel from '../models/credential.model.v2.js';
import RestResult from '../models/restResult.model.v2.js';
import Errors from '../lib/errors.js';
import mysql from '../lib/mysql.js';
import postgres from '../lib/postgres.js';
import mssql from '../lib/mssql.js';
import oracle from '../lib/oracle.js';
import mongodb from '../lib/mongodb.js';

const credentialController = {
  async find(req, res) {
    try {
      if (req.query.name) {
        const credential = await CredentialModel.findByName(req.query.name);
        res.json(RestResult.single(credential));
      } else {
        const credentials = await CredentialModel.findAll();
        res.json(RestResult.list(credentials));
      }
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async create(req, res) {
    try {
      const credential = await CredentialModel.create(req.body);
      res.json(RestResult.single({ message: 'Credential created', id: credential }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async findById(req, res) {
    try {
      const credential = await CredentialModel.findById(req.params.id);
      credential.password = '********';
      res.json(RestResult.single(credential));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async update(req, res) {
    try {
      await CredentialModel.update(req.body, req.params.id);
      res.json(RestResult.single({ message: 'Credential updated' }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async delete(req, res) {
    try {
      await CredentialModel.delete(req.params.id);
      res.json(RestResult.single({ message: 'Credential deleted' }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async testDb(req, res) {
    try {
      const credential = await CredentialModel.findById(req.params.id);
      const db_type = credential.db_type;
      let result;
      if (db_type === 'mysql') {
        result = await mysql.query(credential.name, 'select 1');
      } else if (db_type === 'mssql') {
        result = await mssql.query(credential.name, 'select 1');
      } else if (db_type === 'postgres') {
        result = await postgres.query(credential.name, 'select 1');
      } else if (db_type === 'oracle') {
        result = await oracle.query(credential.name, 'select 1');
      } else if (db_type === 'mongodb') {
        result = await mongodb.query(credential.name, 'admin~system.version~{}');
      } else {
        throw new Errors.BadRequestError('Database type not set');
      }
      res.json(RestResult.single({ message: 'Database connection ok' }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default credentialController;
