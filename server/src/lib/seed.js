// Declarative config seed (config as code for the admin objects).
//
// When CONFIG_SEED_PATH is set, the file it points to is read at startup and
// the admin objects it declares (awx, credentials, oauth2 providers,
// repositories, ldap, settings) are upserted into the database. Objects that
// come from the seed are flagged `managed` : they are enforced on every apply
// and the API refuses manual changes to them, while anything created by hand
// stays untouched. Removing an object from the seed releases the flag ;
// deleting it too requires `prune: true` on the section.
//
// An invalid seed (bad yaml, schema violation, unresolved ${ENV} reference)
// is fatal on purpose : the server refuses to start rather than run with a
// configuration that does not match what the operator declared.
import fs from "fs";
import yaml from "yaml";
import logger from "./logger.js";
import crypto from "./crypto.js";
import appConfig from "../../config/app.config.js";
import { validateSeed, interpolateEnv } from "./seed-schema.js";
import CrudModel from "../models/crud.model.js";
import Awx from "../models/awx.model.js";
import OAuth2 from "../models/oauth2.model.js";
import Credential from "../models/credential.model.v2.js";
import Repository from "../models/repository.model.js";
import Ldap from "../models/ldap.model.js";
import Settings from "../models/settings.model.js";
import mysql from "../models/db.model.js";

const seedOpts = { fromSeed: true };

// The list sections all share the same upsert/release/prune mechanics ; only
// the model calls differ (repositories are keyed by name in their model API).
const listSections = [
  {
    key: "awx",
    modelName: "awx",
    create: (d) => Awx.create(d, seedOpts),
    update: (d, row) => Awx.update(d, row.id, seedOpts),
    remove: (row) => Awx.delete(row.id, seedOpts),
  },
  {
    key: "credentials",
    modelName: "credential",
    defaults: { description: "" },
    create: (d) => Credential.create(d, seedOpts),
    update: (d, row) => Credential.update(d, row.id, seedOpts),
    remove: (row) => Credential.delete(row.id, seedOpts),
  },
  {
    key: "oauth2",
    modelName: "oauth2",
    create: (d) => OAuth2.create(d, seedOpts),
    update: (d, row) => OAuth2.update(d, row.id, seedOpts),
    remove: (row) => OAuth2.delete(row.id, seedOpts),
  },
  {
    key: "repositories",
    modelName: "repositories",
    defaults: { description: "" },
    create: (d) => Repository.create(d, seedOpts),
    update: (d, row) => Repository.update(d, row.name, seedOpts),
    remove: (row) => Repository.delete(row.name, seedOpts),
  },
];

async function applyListSection(section, cfg, summary) {
  const items = cfg.items || [];
  const declared = new Set(items.map((i) => i.name));

  for (const item of items) {
    const data = { ...(section.defaults || {}), ...item, managed: true };
    const existing = await CrudModel.findByName(section.modelName, item.name);
    if (existing) {
      await section.update(data, existing);
      summary.updated++;
    } else {
      await section.create(data);
      summary.created++;
    }
  }

  // managed rows that are no longer declared : release them, or delete them
  // when the section asks for pruning ; rows created by hand are never touched
  const all = await CrudModel.findAll(section.modelName);
  for (const row of all) {
    if (row.managed && !declared.has(row.name)) {
      if (cfg.prune) {
        await section.remove(row);
        summary.pruned++;
      } else {
        await CrudModel.update(section.modelName, { managed: false }, row.id, seedOpts);
        summary.released++;
      }
    }
  }
}

async function applyLdap(cfg) {
  // the Ldap constructor handles boolean casts, password encryption and the
  // advanced-mode field grooming, exactly like a save from the UI would
  const record = { ...new Ldap(cfg) };
  delete record.testuser;
  delete record.testpassword;
  for (const k of Object.keys(record)) {
    if (record[k] === undefined) delete record[k];
  }
  record.managed = 1;
  await Ldap.update(record);
}

async function applySettings(cfg) {
  // partial update on purpose : the settings row also carries forms_yaml and
  // the logo, which are not seed material and must survive untouched
  const record = {};
  for (const k of ["mail_server", "mail_port", "mail_username", "mail_from", "url"]) {
    if (cfg[k] !== undefined) record[k] = cfg[k];
  }
  if (cfg.mail_secure !== undefined) record.mail_secure = cfg.mail_secure ? 1 : 0;
  if (cfg.mail_password !== undefined) {
    record.mail_password = cfg.mail_password === "" ? "" : crypto.encrypt(cfg.mail_password);
  }
  record.managed = 1;
  await Settings.update(record);
}

// Applies the seed file if CONFIG_SEED_PATH is set. Returns a summary object,
// or null when no seed is configured. Throws on any error : the caller treats
// that as fatal.
export async function applyConfigSeed({ schemaIsReady = true } = {}) {
  const seedPath = appConfig.seedPath;
  if (!seedPath) return null;

  if (!schemaIsReady) {
    throw new Error("CONFIG_SEED_PATH is set but the database schema is not ready");
  }
  if (!fs.existsSync(seedPath)) {
    throw new Error(`CONFIG_SEED_PATH points to '${seedPath}' but the file does not exist`);
  }

  logger.notice(`Applying config seed from ${seedPath}`);
  let doc = yaml.parse(fs.readFileSync(seedPath, "utf8"));
  if (doc === null || doc === undefined) doc = {};
  doc = interpolateEnv(doc);
  validateSeed(doc);

  const summary = { created: 0, updated: 0, released: 0, pruned: 0 };

  for (const section of listSections) {
    // an absent section behaves like an empty one : its managed rows are released
    await applyListSection(section, doc[section.key] || { items: [] }, summary);
  }

  if (doc.ldap) {
    await applyLdap(doc.ldap);
  } else {
    await mysql.do("UPDATE AnsibleForms.`ldap` SET managed=0 WHERE managed=1");
  }

  if (doc.settings) {
    await applySettings(doc.settings);
  } else {
    await mysql.do("UPDATE AnsibleForms.`settings` SET managed=0 WHERE managed=1");
  }

  logger.notice(
    `Config seed applied : ${summary.created} created, ${summary.updated} updated, ${summary.released} released, ${summary.pruned} pruned`
  );
  return summary;
}

export default { applyConfigSeed };
