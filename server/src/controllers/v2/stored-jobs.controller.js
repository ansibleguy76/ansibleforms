"use strict";
import CrudModel from "../../models/crud.model.js";
import RestResult from "../../models/restResult.model.v2.js";
import Errors from "../../lib/errors.js";

const stored_jobsController = {
  async find(req, res) {
    try {
      const username = `${req.user.user.type}/${req.user.user.username}`;
      
      if (req.query.name) {
        // Find by name (with username filter for security)
        const all = await CrudModel.findAll('stored_jobs');
        const item = all.find(s => s.username === username && s.name === req.query.name);
        return res.json(RestResult.single(item));
      } else if (req.query.form_name) {
        // Filter by form and username (used by form page Load button)
        const all = await CrudModel.findAll('stored_jobs');
        const filtered = all.filter(s => s.form_name === req.query.form_name && s.username === username);
        return res.json(RestResult.list(filtered));
      } else {
        // Return all stored jobs (for admin page management)
        const all = await CrudModel.findAll('stored_jobs');
        return res.json(RestResult.list(all));
      }
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async create(req, res) {
    try {
      // Add username from authenticated user (format: type/username)
      const data = {
        ...req.body,
        username: `${req.user.user.type}/${req.user.user.username}`
      };
      const id = await CrudModel.create('stored_jobs', data);
      return res.status(201).json(RestResult.single("stored job added", { id }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async findById(req, res) {
    try {
      const username = `${req.user.user.type}/${req.user.user.username}`;
      const isAdmin = req.user.user.options?.showSettings;
      const item = await CrudModel.findById('stored_jobs', req.params.id);
      
      // Verify user owns this item (or is admin)
      if (!isAdmin && item.username !== username) {
        throw new Errors.AccessDeniedError("You do not have access to this stored job");
      }
      return res.json(RestResult.single(item));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async update(req, res) {
    try {
      const username = `${req.user.user.type}/${req.user.user.username}`;
      const isAdmin = req.user.user.options?.showSettings;
      
      // Verify user owns this item (or is admin)
      const existing = await CrudModel.findById('stored_jobs', req.params.id);
      if (!isAdmin && existing.username !== username) {
        throw new Errors.AccessDeniedError("You do not have access to this stored job");
      }
      
      // Don't allow changing username
      const data = { ...req.body };
      delete data.username;
      
      await CrudModel.update('stored_jobs', data, req.params.id);
      return res.json(RestResult.single("stored job updated"));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async delete(req, res) {
    try {
      const username = `${req.user.user.type}/${req.user.user.username}`;
      const isAdmin = req.user.user.options?.showSettings;
      
      // Verify user owns this item (or is admin)
      const existing = await CrudModel.findById('stored_jobs', req.params.id);
      if (!isAdmin && existing.username !== username) {
        throw new Errors.AccessDeniedError("You do not have access to this stored job");
      }
      
      await CrudModel.delete('stored_jobs', req.params.id);
      return res.json(RestResult.single("stored job deleted"));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default stored_jobsController;
