"use strict";
import Awx from "../../models/awx.model.js";
import RestResult from "../../models/restResult.model.v2.js";
import Errors from "../../lib/errors.js";
import i18n from "../../lib/i18n.js";

// List all AWX or filter by name
// The token and the password are stored encrypted and CrudModel.postProcess decrypts
// them, so anything returned from here must be masked. Every sibling resource masks its
// secret (credential password, oauth2 client_secret, repository password, ldap
// bind_user_pw, settings mail_password) - AWX did not mask `token` at all, so a
// showSettings user could read the AAP token in clear from the list endpoint. That
// matters more now that the config seed writes those tokens from a git manifest.
// Masks onto a COPY rather than mutating the record.
//
// Not because mutating is currently broken - it is not. awx has allowCache on, and
// job.model launches every AWX/AAP job through the same `AwxModel.findByName(name)` and
// therefore the same cache entry, so masking in place LOOKS like it would poison the token
// a job authenticates with. It does not: node-cache defaults to `useClones: true`, so get()
// hands back a clone (verified). The copy is here so that safety does not depend on a
// library default that a future `useClones: false` - the obvious way to speed this cache up -
// would silently remove, taking every AWX job with it.
const MASK = "********";
function maskSecrets(awx) {
  if (!awx) return awx;
  const copy = { ...awx };
  if (copy.password) copy.password = MASK;
  if (copy.token) copy.token = MASK;
  return copy;
}

const find = async (req, res) => {
  try {
    if (req.query.name) {
      const awx = await Awx.findByName(req.query.name);
      return res.json(RestResult.single(maskSecrets(awx)));
    } else {
      const awxList = await Awx.findAll();
      return res.json(RestResult.list((awxList || []).map(maskSecrets)));
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
    return res.json(RestResult.single(maskSecrets(awx)));
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
    await Awx.check(awx);
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
