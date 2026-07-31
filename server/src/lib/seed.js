'use strict';
// Declarative config seed : config as code for the admin objects.
//
// When CONFIG_SEED_PATH is set, that file is read at startup and the objects it
// declares (awx, credentials, oauth2 providers, repositories, ldap, mail/url) are
// upserted into the database. This is the piece that lets a whole instance be
// rebuilt from git on an empty database - see docs/seed.md.
//
// Objects that come from the seed are flagged `managed` : the seed re-applies them on
// every start and the API refuses to change them, so the file stays authoritative.
// Dropping an object from the file releases the flag (the record stays, editable
// again) ; `prune: true` on a section deletes it instead.
//
// A hand-made object is never touched UNLESS the seed declares its name, in which case
// it is adopted : the declared fields are enforced and it becomes read-only. That is
// the right outcome, but it overwrites what somebody typed, so it is logged as a
// warning and recorded in the audit entry rather than happening silently.
//
// An invalid seed is FATAL on purpose. The alternative - carry on with the previous
// configuration - means an instance whose behaviour no longer matches the manifest
// that is supposed to describe it, and nothing says so out loud.
import fs from "fs";
import path from "path";
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
import Audit from "../models/audit.model.js";
import mysql from "../models/db.model.js";

// The one thing that distinguishes the seed from an API caller. Everything the seed
// writes goes through the normal models, so encryption, the is_default handling and
// the repository clone behave exactly as they do for a save from the UI.
const seedOpts = { fromSeed: true };

// The comparison below works on decrypted values throughout : CrudModel.findByName
// (postProcess), Ldap.find and Settings.find all decrypt their secret columns before
// returning, so a declared plaintext password can be compared with what is stored.
const listSections = [
  {
    key: "awx",
    modelName: "awx",
    label: "awx",
    create: (d) => Awx.create(d, seedOpts),
    update: (d, row) => Awx.update(d, row.id, seedOpts),
    remove: (row) => Awx.delete(row.id, seedOpts),
  },
  {
    key: "credentials",
    modelName: "credential",
    label: "credential",
    defaults: { description: "" },
    create: (d) => Credential.create(d, seedOpts),
    update: (d, row) => Credential.update(d, row.id, seedOpts),
    remove: (row) => Credential.delete(row.id, seedOpts),
  },
  {
    key: "oauth2",
    modelName: "oauth2",
    label: "oauth2",
    create: (d) => OAuth2.create(d, seedOpts),
    update: (d, row) => OAuth2.update(d, row.id, seedOpts),
    remove: (row) => OAuth2.delete(row.id, seedOpts),
  },
  {
    key: "repositories",
    modelName: "repositories",
    label: "repository",
    defaults: { description: "" },
    create: (d) => Repository.create(d, seedOpts),
    // NOT Repository.update : it runs removeEmptyFields, which DROPS a declared "" before
    // writing. differs() then still sees "" vs the stored value, so a seed that clears a
    // repository's user/password/cron reported "1 updated" on every boot for ever while
    // never actually clearing it - the old credential kept being injected into the clone
    // URL. Going through CrudModel writes the empty value, which is what was declared.
    update: (d, row) => CrudModel.update("repositories", d, row.id, seedOpts),
    remove: (row) => Repository.delete(row.name, seedOpts),
  },
];

// JSON with object keys in a stable (sorted) order, recursively, so two structurally
// equal documents always produce the same string. Array order is meaningful and is kept.
// Exported for the test that pins the MySQL key-sorting behaviour this exists for.
export function canonicalJson(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

// Whether any declared field differs from what is stored.
//
// Without this the seed would rewrite every row on every boot, because encryption
// uses a random IV : the same password produces different ciphertext each time, so
// "did it change?" cannot be answered by comparing what is about to be written. That
// would make the audit trail claim a change on every restart and make the applied
// counts meaningless. Comparison is loose (String()) because a port declared as 389
// comes back from MySQL as "389" in a varchar column.
function differs(declared, stored) {
  for (const [key, value] of Object.entries(declared)) {
    if (key === "managed") continue;
    const before = stored[key];
    if (typeof value === "boolean") {
      if ((before ? 1 : 0) !== (value ? 1 : 0)) return true;
      continue;
    }
    if (value === null || value === undefined) continue;
    // A JSON column (oauth2_providers.extra) is returned PARSED by mysql2, so String()
    // gives "[object Object]" and every comparison against the declared string differed
    // - rewriting the row on every boot, and with it re-running the "only one enabled
    // provider per type" side effect that disables a sibling somebody enabled by hand.
    //
    // Comparing must be CANONICAL, not just structural: MySQL sorts an object's keys when
    // it stores JSON (verified - '{"b":2,"a":1}' comes back as '{"a":1,"b":2}'), while
    // JSON.parse preserves the declared order. A plain JSON.stringify of each side
    // therefore still differs for any declared object whose keys are not already sorted.
    if (before !== null && typeof before === "object") {
      let parsed = value;
      if (typeof value === "string") {
        try { parsed = JSON.parse(value); } catch { parsed = value; }
      }
      if (canonicalJson(before) !== canonicalJson(parsed)) return true;
      continue;
    }
    if (String(before ?? "") !== String(value)) return true;
  }
  return false;
}

/**
 * The record to write for a declared item.
 *
 * `section.defaults` are applied on CREATE ONLY. They exist purely to satisfy columns
 * with no database default (credentials.description is NOT NULL without one), and
 * applying them on UPDATE too meant a seed that says nothing about `description`
 * BLANKED an existing one - which on a hand-made record adopted by name silently
 * destroyed somebody's text. Exported so that stays covered by a test.
 */
export function buildRecord(section, item, isCreate) {
  return isCreate
    ? { ...(section.defaults || {}), ...item, managed: true }
    : { ...item, managed: true };
}

async function applyListSection(section, cfg, summary) {
  const items = cfg.items || [];
  const declared = new Set(items.map((i) => i.name));

  for (const item of items) {
    const existing = await CrudModel.findByName(section.modelName, item.name);
    if (existing) {
      const data = buildRecord(section, item, false);
      // already managed and unchanged : leave the row alone entirely
      if (existing.managed && !differs(data, existing)) {
        summary.unchanged++;
        continue;
      }
      // Declaring a name that already exists ADOPTS that record : its declared fields
      // are overwritten and it becomes read-only. That is the right outcome (the file
      // is authoritative) but it is not obvious from the file, so say so out loud -
      // otherwise the only signal is somebody's hand-made entry quietly changing.
      if (!existing.managed) {
        logger.warning(`Config seed adopts the existing ${section.label} '${item.name}', which was not managed before : its declared fields are now enforced from the seed file`);
        summary.adopted.push(`${section.label}:${item.name}`);
      }
      await section.update(data, existing);
      summary.updated.push(`${section.label}:${item.name}`);
    } else {
      const data = buildRecord(section, item, true);
      await section.create(data);
      summary.created.push(`${section.label}:${item.name}`);
    }
  }

  // Managed rows that are no longer declared. Released by default (the record stays
  // and becomes editable again) or deleted when the section asks to prune. Rows that
  // were never managed are somebody's manual work and are never considered here.
  const all = await CrudModel.findAll(section.modelName);
  for (const row of all) {
    if (!row.managed || declared.has(row.name)) continue;
    if (cfg.prune) {
      await section.remove(row);
      summary.pruned.push(`${section.label}:${row.name}`);
    } else {
      await CrudModel.update(section.modelName, { managed: false }, row.id, seedOpts);
      summary.released.push(`${section.label}:${row.name}`);
    }
  }
}

/**
 * Re-clone a seeded repository that has no working tree.
 *
 * Repository.create fires Repository.clone WITHOUT awaiting it, and only the CREATE path
 * does. So if that first clone failed - bad credentials, DNS, or the pod killed mid-clone by
 * a readiness probe - every later boot took the `unchanged` fast path, because status/head/
 * output are runtime state and deliberately not declarable, so differs() never looks at
 * them. A repository marked use_for_config then made the instance serve NO forms, for ever,
 * while the seed reported itself applied.
 *
 * Checking the directory rather than `status` on purpose: status can read 'success' from an
 * earlier life while the tree has since been removed, and a 'failed' row whose tree is
 * actually fine must not be re-cloned underneath a working instance. The atomic
 * status='running' claim inside clone() is what keeps this from racing the boot rebase.
 */
async function ensureRepositoryClones(doc, summary) {
  for (const item of doc.repositories?.items || []) {
    const dir = path.join(appConfig.repoPath, item.name);
    if (fs.existsSync(dir)) continue;
    logger.warning(`Seeded repository '${item.name}' has no working tree : cloning it again`);
    summary.recloned.push(`repository:${item.name}`);
    // not awaited, exactly like the create path : a slow clone must not delay the boot,
    // and the claim serialises it against the rebase block that runs later
    Repository.clone(item.name).catch((e) => {
      logger.error(`Re-clone of seeded repository '${item.name}' failed : ${e.message || e}`);
    });
  }
}

async function applyLdap(cfg, summary) {
  const stored = await Ldap.find();
  // The Ldap constructor does the boolean casts and the password encryption, exactly as
  // a save from the UI would - but it also MATERIALISES every field it knows about:
  // absent booleans become 0 and the four group fields become "". Writing that record
  // wholesale blanked seven fields the seed never mentioned, which on an instance with
  // hand-configured LDAP set enable=0 and destroyed the group mapping - it stopped
  // directory logins. So take only the keys the seed actually declared, with the
  // constructor's conversion applied. Same rule as applySettings, and as buildRecord.
  const converted = { ...new Ldap(cfg) };
  const record = {};
  for (const key of Object.keys(converted)) {
    if (key === 'testuser' || key === 'testpassword') continue;
    if (cfg[key] === undefined) continue;          // not declared : leave it alone
    if (converted[key] === undefined) continue;
    record[key] = converted[key];
  }
  // compare against what was declared, not against the freshly encrypted record
  if (stored?.managed && !differs(cfg, stored)) {
    summary.unchanged++;
    return;
  }
  // Same signal as for the list sections : taking over a hand-configured directory is
  // the most consequential adoption of all, so it must not happen silently.
  if (!stored?.managed) {
    logger.warning("Config seed adopts the existing ldap configuration, which was not managed before : its declared fields are now enforced from the seed file");
    summary.adopted.push("ldap");
  }
  record.managed = 1;
  await Ldap.update(record);
  summary.updated.push("ldap");
}

async function applySettings(cfg, summary) {
  const stored = await Settings.find();
  // Partial update on purpose : the settings row also carries forms_yaml, the logo
  // and the theme defaults, none of which are seed material.
  const record = {};
  for (const k of ["mail_server", "mail_port", "mail_username", "mail_from", "url"]) {
    if (cfg[k] !== undefined) record[k] = cfg[k];
  }
  if (cfg.mail_secure !== undefined) record.mail_secure = cfg.mail_secure ? 1 : 0;
  if (cfg.mail_password !== undefined) {
    record.mail_password = cfg.mail_password === "" ? "" : crypto.encrypt(cfg.mail_password);
  }
  if (stored?.managed && !differs(cfg, stored)) {
    summary.unchanged++;
    return;
  }
  if (!stored?.managed) {
    logger.warning("Config seed adopts the existing mail/url settings, which were not managed before : its declared fields are now enforced from the seed file");
    summary.adopted.push("settings");
  }
  record.managed = 1;
  await Settings.update(record);
  summary.updated.push("settings");
}

/**
 * Applies the seed file when CONFIG_SEED_PATH is set. Returns a summary, or null when
 * no seed is configured. Throws on anything wrong : the caller treats that as fatal.
 */
export async function applyConfigSeed({ schemaIsReady = true } = {}) {
  const seedPath = appConfig.configSeedPath;
  if (!seedPath) return null;

  // NOT fatal on its own. `schemaIsReady` is false when hasSchema() collected ANY failure -
  // including a single addIndex that could not apply, which schemaCheck itself grades only a
  // WARNING ("slow, not broken"). Refusing to start on that turned an upgrade into a
  // CrashLoopBackOff with no way in: the app never listens, so POST /api/v2/schema - the
  // documented manual repair, and the readiness probe in docs/seed.md - is unreachable, and
  // the only escape is editing the Deployment to unset CONFIG_SEED_PATH. It also contradicted
  // schema.model.js's own note that a missing ALTER grant "does not stop the app".
  //
  // So attempt the seed anyway. If it genuinely cannot write, the model throws a real error
  // naming the table or column, and THAT is fatal - which is better diagnostics than a
  // blanket refusal, and it cannot fire on a gap the seed does not care about.
  if (!schemaIsReady) {
    logger.warning("The database schema reported problems ; applying the config seed anyway - a real failure will name the table or column");
  }
  if (!fs.existsSync(seedPath)) {
    throw new Error(`CONFIG_SEED_PATH points to '${seedPath}' but that file does not exist`);
  }
  // A directory passes existsSync and then fails the read with a bare "EISDIR: illegal
  // operation on a directory". That is the likeliest mistake of all on kubernetes, where
  // a ConfigMap mounts AS a directory - CONFIG_SEED_PATH=/seed instead of /seed/seed.yaml.
  // Worth naming, since the operator only sees this in a crash-looping pod's log.
  if (!fs.statSync(seedPath).isFile()) {
    throw new Error(`CONFIG_SEED_PATH points to '${seedPath}' which is a directory, not a file (a mounted ConfigMap is a directory - point this at the file inside it)`);
  }

  logger.notice(`Applying config seed from ${seedPath}`);
  let doc = yaml.parse(fs.readFileSync(seedPath, "utf8"));
  // an empty file is a valid seed that declares nothing : it releases everything
  if (doc === null || doc === undefined) doc = {};
  if (typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("Seed file must contain a yaml mapping at the top level");
  }
  doc = interpolateEnv(doc);
  validateSeed(doc);

  const summary = { created: [], updated: [], released: [], pruned: [], adopted: [], recloned: [], unchanged: 0 };

  // There is no transaction across the sections, so a failure part way through leaves
  // the database half applied. It re-converges on the next boot, but the records already
  // written would otherwise carry a `managed` flag with nothing in the trail explaining
  // who set it - so record what got as far as being applied, then re-throw.
  try {
    await applySections(doc, summary);
  } catch (e) {
    await logApply(seedPath, summary, 'failure');
    throw e;
  }

  await logApply(seedPath, summary, 'success');
  return summary;
}

async function applySections(doc, summary) {
  for (const section of listSections) {
    // an absent section behaves like an empty one, so deleting a block from the file
    // releases its records rather than freezing them for ever
    await applyListSection(section, doc[section.key] || { items: [] }, summary);
  }

  await ensureRepositoryClones(doc, summary);

  if (doc.ldap) {
    await applyLdap(doc.ldap, summary);
  } else {
    const res = await mysql.do("UPDATE AnsibleForms.`ldap` SET managed=0 WHERE managed=1");
    if (res.affectedRows > 0) summary.released.push("ldap");
  }

  if (doc.settings) {
    await applySettings(doc.settings, summary);
  } else {
    const res = await mysql.do("UPDATE AnsibleForms.`settings` SET managed=0 WHERE managed=1");
    if (res.affectedRows > 0) summary.released.push("settings");
  }

}

// One entry per apply that changed something. Names only : never a declared value,
// which is very often a secret. A no-op apply writes nothing, so the trail stays
// meaningful instead of gaining a row per restart.
async function logApply(seedPath, summary, outcome) {
  const counts = {
    created: summary.created.length,
    updated: summary.updated.length,
    released: summary.released.length,
    pruned: summary.pruned.length,
    unchanged: summary.unchanged,
  };
  if (outcome === 'success') logger.notice(
    `Config seed applied : ${counts.created} created, ${counts.updated} updated, ` +
    `${counts.released} released, ${counts.pruned} pruned, ${counts.unchanged} unchanged`
  );

  // The seed runs at startup, outside any request, so the audit middleware never sees
  // it - without this a credential would change owner with no trace of who or why.
  if (counts.created || counts.updated || counts.released || counts.pruned) {
    await Audit.log({
      action: "seed.apply",
      outcome,
      targetType: "seed",
      target: seedPath,
      // The lists ARE the counts - spreading `counts` in as well only produced keys the
      // arrays then overwrote, so `created` read as a list and `created` as a number
      // silently vanished. `unchanged` has no list, so it stays a number.
      detail: {
        created: summary.created,
        updated: summary.updated,
        released: summary.released,
        pruned: summary.pruned,
        adopted: summary.adopted,
        recloned: summary.recloned,
        unchanged: counts.unchanged,
      },
    });
  }
}

export { listSections };
export default { applyConfigSeed };
