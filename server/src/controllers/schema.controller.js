'use strict';
import Schema from '../models/schema.model.js';
import RestResult from '../models/restResult.model.v2.js';
import errors from '../lib/errors.js';

const schemaController = {
  async hasSchema(req, res) {
    try {
      const result = await Schema.hasSchema();
      if(!result?.data){
        errors.ReturnError(res, new Error(`FATAL ERROR : ${result.message}`));
      }
      res.json(RestResult.single(result.data))
    } catch (err) {
      errors.ReturnError(res, err);
    }

  },

  async create(req, res) {
    try {
      const result = await Schema.create();
      res.json(RestResult.single(result));
    } catch (err) {
      errors.ReturnError(res, err);
    }
  }
}


export default schemaController;
