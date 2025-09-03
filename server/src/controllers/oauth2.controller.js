

'use strict';
import OAuth2 from '../models/oauth2.model.js';
import RestResult from '../models/restResult.model.v2.js';
import Errors from '../lib/errors.js';
import auth_azuread from '../auth/auth_azuread.js';
import auth_oidc from '../auth/auth_oidc.js';

const oauth2Controller = {
  // List all OAuth2 providers or filter by name
  async find(req, res) {
    try {
      if (req.query.name) {
        const oauth2 = await OAuth2.findByName(req.query.name);
        return res.json(RestResult.single(oauth2));
      } else {
        const oauth2List = await OAuth2.findAll();
        return res.json(RestResult.list(oauth2List));
      }
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  // Create new OAuth2 provider
  async create(req, res) {
    try {
      const created = await OAuth2.create(req.body);
      return res.status(201).json(RestResult.single("oauth2 provider added", created));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  // Find by ID
  async findById(req, res) {
    try {
      const oauth2 = await OAuth2.findById(req.params.id);
      oauth2.client_secret = "********"; // mask the client_secret for API
      return res.json(RestResult.single(oauth2));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  // Update OAuth2 provider
  async update(req, res) {
    try {
      const updated = await OAuth2.update(req.body, req.params.id);
      await auth_azuread.initialize(); // we wait for the azuread to be ready
      await auth_oidc.initialize(); // we wait for the oidc to be ready      
      return res.json(RestResult.single(updated));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  // Delete OAuth2 provider
  async delete(req, res) {
    try {
      const deleted = await OAuth2.delete(req.params.id);
      return res.json(RestResult.single(deleted));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default oauth2Controller;
