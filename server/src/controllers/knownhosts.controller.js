'use strict';
import KnownHosts from '../models/knownhosts.model.js';
import RestResult from '../models/restResult.model.v2.js';
import Errors from '../lib/errors.js';

// Controller following v2 response conventions
const knownhostsController = {
  // Return the full list of known hosts
  async find(req, res) {
    try {
      const hosts = await KnownHosts.findAll();
      return res.json(RestResult.list(hosts));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  // Add a host key(s) to known_hosts
  async add(req, res) {
    try {
      const host = (req.body?.host || '').trim();
      if (!host) {
        return res.status(400).json(RestResult.error('host value required'));
      }
      const output = await KnownHosts.add(host);
      return res.status(201).json(RestResult.single({ message: 'Host added', host, output }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  // Remove a host from known_hosts
  async remove(req, res) {
    try {
      const name = (req.query?.name || '').trim();
      if (!name) {
        return res.status(400).json(RestResult.error('host name (query param "name") required'));
      }
      const output = await KnownHosts.remove(name);
      return res.json(RestResult.single({ message: 'Host removed', host: name, output }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default knownhostsController;
