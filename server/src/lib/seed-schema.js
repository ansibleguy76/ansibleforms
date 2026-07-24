// Declarative config seed : schema validation and environment interpolation.
// Pure helpers with no database access, so they are unit testable.
// The seed file itself never contains secrets : secret values are referenced
// as ${SOME_ENV_VAR} and resolved from the process environment at apply time.
import Ajv from "ajv";

const str = { type: "string" };
const bool = { type: "boolean" };
// numeric fields may arrive as strings when they come from ${ENV} interpolation
const strOrInt = { type: ["string", "integer"] };

const awxItem = {
  type: "object",
  additionalProperties: false,
  required: ["name", "uri"],
  properties: {
    name: str,
    description: str,
    uri: str,
    is_default: bool,
    use_credentials: bool,
    username: str,
    password: str,
    token: str,
    ignore_certs: bool,
    ca_bundle: str,
  },
};

const credentialItem = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: str,
    description: str,
    user: str,
    password: str,
    host: str,
    port: strOrInt,
    db_name: str,
    db_type: str,
    secure: bool,
    is_database: bool,
    vault_path: str,
  },
};

const oauth2Item = {
  type: "object",
  additionalProperties: false,
  required: ["name", "provider", "client_id", "client_secret"],
  properties: {
    name: str,
    description: str,
    provider: str,
    issuer: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    enable: bool,
    groupfilter: str,
    redirect_uri: str,
    scope: str,
    auth_url: str,
    token_url: str,
    userinfo_url: str,
    extra: str,
  },
};

const repositoryItem = {
  type: "object",
  additionalProperties: false,
  required: ["name", "uri"],
  properties: {
    name: str,
    description: str,
    uri: str,
    branch: str,
    user: str,
    password: str,
    use_for_config: bool,
    use_for_forms: bool,
    use_for_playbooks: bool,
    use_for_vars_files: bool,
    rebase_on_start: bool,
    cron: str,
  },
};

const listSection = (item) => ({
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    prune: bool,
    items: { type: "array", items: item },
  },
});

const ldapSection = {
  type: "object",
  additionalProperties: false,
  required: ["server", "port", "bind_user_dn", "bind_user_pw", "search_base", "username_attribute"],
  properties: {
    server: str,
    port: strOrInt,
    ignore_certs: bool,
    enable_tls: bool,
    cert: str,
    ca_bundle: str,
    bind_user_dn: str,
    bind_user_pw: str,
    search_base: str,
    username_attribute: str,
    groups_attribute: str,
    enable: bool,
    is_advanced: bool,
    groups_search_base: str,
    group_class: str,
    group_member_attribute: str,
    group_member_user_attribute: str,
    mail_attribute: str,
  },
};

const settingsSection = {
  type: "object",
  additionalProperties: false,
  properties: {
    mail_server: str,
    mail_port: strOrInt,
    mail_secure: bool,
    mail_username: str,
    mail_password: str,
    mail_from: str,
    url: str,
  },
};

export const seedSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "integer", enum: [1] },
    awx: listSection(awxItem),
    credentials: listSection(credentialItem),
    oauth2: listSection(oauth2Item),
    repositories: listSection(repositoryItem),
    ldap: ldapSection,
    settings: settingsSection,
  },
};

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validator = ajv.compile(seedSchema);

// Validates the parsed seed document ; throws with all validation messages
// combined so the operator sees everything wrong in one go.
export function validateSeed(doc) {
  if (!validator(doc)) {
    const details = (validator.errors || [])
      .map((e) => `${e.instancePath || "/"} ${e.message}`)
      .join(" ; ");
    throw new Error(`Seed file validation failed : ${details}`);
  }
  return true;
}

// Recursively replaces ${VAR} references in all string values with the
// corresponding environment variable. Unknown variables are collected and
// reported in a single error : a seed with unresolved secrets must not apply.
export function interpolateEnv(value, env = process.env) {
  const missing = new Set();
  const walk = (v) => {
    if (typeof v === "string") {
      return v.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => {
        if (env[name] === undefined) {
          missing.add(name);
          return match;
        }
        return env[name];
      });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  const result = walk(value);
  if (missing.size > 0) {
    throw new Error(`Seed file references undefined environment variables : ${[...missing].sort().join(", ")}`);
  }
  return result;
}
