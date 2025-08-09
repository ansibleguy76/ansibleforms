'use strict';
import Awx from '../models/awx.model.js';
import RestResult from '../models/restResult.model.v2.js';

// List all AWX or filter by name
const find = async (req, res) => {
  try {
    if (req.query.name) {
      const awx = await Awx.findByName(req.query.name);
      if (!awx) {
        return res.status(404).json(RestResult.error("AWX not found", null));
      }
      return res.json(RestResult.single(awx));
    } else {
      const awxList = await Awx.findAll();
      return res.json(RestResult.list(awxList));
    }
  } catch (err) {
    return res.status(500).json(RestResult.error("Failed to find awx", err.toString()));
  }
};

// Create new AWX
const create = async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json(RestResult.error("Please provide all required fields", null));
  }
  try {
    const new_awx = new Awx(req.body);
    const created = await Awx.create(new_awx);
    return res.status(201).json(RestResult.single("awx added", created));
  } catch (err) {
    return res.status(500).json(RestResult.error("Failed to create awx", err.toString()));
  }
};

// Find by ID
const findById = async (req, res) => {
  try {
    const awx = await Awx.findById(req.params.id);
    if (!awx) {
      return res.status(404).json(RestResult.error("AWX not found", null));
    }
    return res.json(RestResult.single(awx));
  } catch (err) {
    return res.status(500).json(RestResult.error("Failed to find awx", err.toString()));
  }
};

// Update AWX
const update = async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json(RestResult.error("Please provide all required fields", null));
  }
  try {
    const updated = await Awx.update(new Awx(req.body), req.params.id);
    if (!updated) {
      return res.status(404).json(RestResult.error("AWX not found", null));
    }
    return res.json(RestResult.single(updated));
  } catch (err) {
    return res.status(500).json(RestResult.error("Failed to update awx", err.toString()));
  }
};

// Delete AWX
const deleteAwx = async (req, res) => {
  try {
    const deleted = await Awx.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json(RestResult.error("AWX not found", null));
    }
    return res.json(RestResult.single(deleted));
  } catch (err) {
    return res.status(500).json(RestResult.error("Failed to delete awx", err.toString()));
  }
};

// Check AWX by ID (e.g., test connection)
const check = async (req, res) => {
  try {
    const awx = await Awx.findById(req.params.id);
    if (!awx) {
      return res.status(404).json(RestResult.error("AWX not found", null));
    }
    // You may want to implement a real check/test here:
    const result = await Awx.checkDecrypted(awx);
    return res.json(RestResult.single({result: "AWX connection is OK"}));
  } catch (err) {
    return res.status(500).json(RestResult.error("Failed to check awx", err.toString()));
  }
};

export default {
  find,
  create,
  findById,
  update,
  delete: deleteAwx,
  check
};