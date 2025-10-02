"use strict";
import DsSchema from "../models/datasourceSchema.model.js";
import RestResult from "../models/restResult.model.js";


const findAllOr1 = async function(req, res) {
  if(req.query.name){
    try {
      const schema = await DsSchema.findByName(req.query.name);
      res.json(new RestResult("success", "schema found", schema, ""));
    } catch (err) {
      res.json(new RestResult("error", "failed to find schema", null, err.toString()));
    }
  }else{
    try {
      const schemas = await DsSchema.findAll();
      res.json(new RestResult("success", "schemas found", schemas, ""));
    } catch (err) {
      res.json(new RestResult("error", "failed to find schemas", null, err.toString()));
    }
  }
};

const create = async function (req, res) {
  try {
    const new_schema = new DsSchema(req.body);
    //handles null error

    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res.status(400).send({ error: true, message: "Please provide all required fields" });
    } else {
      const schema = await DsSchema.create(new_schema);
      res.json(new RestResult("success", "schema added", schema, ""));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to create schema", null, err.toString()));
  }
};
const findById = async function (req, res) {
  try {
    const schema = await DsSchema.findById(req.params.id);
    if (schema.length > 0) {
      res.json(new RestResult("success", "found schema", schema[0], ""));
    } else {
      res.json(new RestResult("error", "failed to find schema", null, err.toString()));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to find schema", null, err.toString()));
  }
};
const update = async function (req, res) {
  try {
    delete req.body.schemaname;
    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res.status(400).send({ error: true, message: "Please provide all required fields" });
    } else {
      await DsSchema.update(new DsSchema(req.body), req.params.id);
      res.json(new RestResult("success", "schema updated", null, ""));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to update schema", null, err.toString()));
  }
};
const deleteDatasourceSchema = async function (req, res) {
  try {
    await DsSchema.delete(req.params.id);
    res.json(new RestResult("success", "schema deleted", null, ""));
  } catch (err) {
    res.json(new RestResult("error", "failed to delete schema", null, err.toString()));
  }
};
const reset = async function (req, res) {
  try {
    await DsSchema.reset(req.params.id);
    res.json(new RestResult("success", "schema is reset", null, ""));
  } catch (err) {
    res.json(new RestResult("error", "failed to reset schema", null, err.toString()));
  }
};

export default {
  findAllOr1,
  create,
  findById,
  update,
  "delete": deleteDatasourceSchema,
  reset
};