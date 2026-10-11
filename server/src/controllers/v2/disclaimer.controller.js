"use strict";
// The disclaimer : what a signed-in user reads and accepts (or declines, and is signed out), and
// Settings > Access > Disclaimer - its text, on or off, and who accepted which version.
import Disclaimer from "../../models/disclaimer.model.js";
import RestResult from "../../models/restResult.model.v2.js";
import Errors from "../../lib/errors.js";
import i18n from "../../lib/i18n.js";
import logger from "../../lib/logger.js";

// ─── every signed-in user ────────────────────────────────────────────────────

// the disclaimer to show, and whether this user still has to accept it
const current = async (req, res) => {
  try {
    const d = await Disclaimer.current();
    const required = await Disclaimer.isRequired(req.user?.user);
    return res.json(RestResult.single({ ...d, required }));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// accepted : recorded with who, which version, when, from where
const accept = async (req, res) => {
  try {
    await Disclaimer.accept(req.user?.user, req.body?.version, req.ip, req.get("user-agent"));
    return res.json(RestResult.single({ message: i18n.t(req, "auth.disclaimerAccepted") }));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

// declined : nothing is recorded but the audit log's entry ; the client signs the user out
const decline = async (req, res) => {
  logger.notice(`${req.user?.user?.username} (${req.user?.user?.type}) declined the disclaimer`);
  return res.json(RestResult.single(null));
};

// ─── Settings > Access > Disclaimer ──────────────────────────────────────────

const settings = async (req, res) => {
  try {
    return res.json(RestResult.single(await Disclaimer.forSettings()));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const saveSettings = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new Errors.BadRequestError(i18n.t(req, "errors.requiredFields"));
    }
    await Disclaimer.save(req.body, req.user?.user?.username);
    return res.json(RestResult.single(await Disclaimer.forSettings()));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const versions = async (req, res) => {
  try {
    return res.json(RestResult.list(await Disclaimer.versions()));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const version = async (req, res) => {
  try {
    return res.json(RestResult.single(await Disclaimer.version(req.params.id)));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

const acceptances = async (req, res) => {
  try {
    return res.json(RestResult.list(await Disclaimer.acceptances()));
  } catch (err) {
    Errors.ReturnError(res, err);
  }
};

export default { current, accept, decline, settings, saveSettings, versions, version, acceptances };
