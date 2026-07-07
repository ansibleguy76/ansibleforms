"use strict";
import Awx from "../../models/awx.model.js";
import RestResult from "../../models/restResult.model.v2.js";
import Errors from "../../lib/errors.js";
import i18n from "../../lib/i18n.js";

// List all AWX or filter by name
const find = async (req, res) => {
  try {
    if (req.query.name) {
      const awx = await Awx.findByName(req.query.name);
      return res.json(RestResult.single(awx));
    } else {
      const awxList = await Awx.findAll();
      return res.json(RestResult.list(awxList));
    }
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// Create new AWX
const create = async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new Errors.BadRequestError(i18n.t(req, 'errors.requiredFields'));
  }
  try {
    const created = await Awx.create(req.body);
    return res.status(201).json(RestResult.single(i18n.t(req, 'resources.awxAdded'), created));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// Find by ID
const findById = async (req, res) => {
  try {
    const awx = await Awx.findById(req.params.id);
    if (!awx) {
      throw new Errors.NotFoundError(i18n.t(req, 'resources.awxNotFound'));
    }
    awx.password = "********"; // mask the password for API
    return res.json(RestResult.single(awx));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// Update AWX
const update = async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new Errors.BadRequestError(i18n.t(req, 'errors.requiredFields'));
  }
  try {
    const updated = await Awx.update(req.body, req.params.id);
    if (!updated) {
      throw new Errors.NotFoundError(i18n.t(req, 'resources.awxNotFound'));
    }
    return res.json(RestResult.single(updated));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// Delete AWX
const deleteAwx = async (req, res) => {
  try {
    const deleted = await Awx.delete(req.params.id);

    if (!deleted) {
      throw new Errors.NotFoundError(i18n.t(req, 'resources.awxNotFound'));
    }
    return res.json(RestResult.single(deleted));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// Check AWX by ID (e.g., test connection)
const check = async (req, res) => {
  try {
    const awx = await Awx.findById(req.params.id);
    const result = await Awx.check(awx);
    return res.json(RestResult.single({ result: i18n.t(req, 'resources.awxConnectionOk') }));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

export default {
  find,
  create,
  findById,
  update,
  delete: deleteAwx,
  check,
};
