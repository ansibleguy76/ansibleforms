// What the settings pages link to a form : the roles that open it and the runners its jobs
// run on, for the Forms tabs of a role, a group, a user and a runner. A form runs where it
// names (`runner: <name>`, `awx: <name>` its deprecated alias), a multistep form where each
// step names ; what names none runs on the default runner of its type (lib/jobTypes.js
// RUNNER_TYPE_OF), as runners/orchestrator.js.
import { RUNNER_TYPE_OF } from './jobTypes.js';

const DEFAULT_TYPE = RUNNER_TYPE_OF;

/**
 * Where one form or one step runs : the runner it names, or the type of the default it takes.
 *
 * Args:
 *   item (object): a form or a step, with type, runner or awx.
 *
 * Returns:
 *   object|null: { runner } when it names one, { defaultType } when it takes the default ;
 *     null for a type that runs nowhere (a multistep form itself, a git job...).
 */
function runsOn(item) {
  const named = item?.runner || item?.awx;
  if (typeof named === 'string' && named.trim()) return { runner: named.trim() };
  const defaultType = DEFAULT_TYPE[item?.type];
  return defaultType ? { defaultType } : null;
}

/**
 * The forms as the settings pages link them : no subform (it is never opened on its own).
 *
 * Args:
 *   forms (object[]): the forms of the full config (Form.load(undefined, undefined, true)).
 *
 * Returns:
 *   object[]: each { name, description, type, roles, runs } - runs, where its jobs run (see
 *     runsOn), once per runner or default type.
 */
export function formLinks(forms) {
  return (Array.isArray(forms) ? forms : [])
    .filter((f) => f && f.name && f.type !== 'subform')
    .map((f) => {
      const steps = f.type === 'multistep' && Array.isArray(f.steps) ? f.steps : [f];
      const runs = [];
      for (const s of steps) {
        const where = runsOn(s);
        if (where && !runs.some((r) => r.runner === where.runner && r.defaultType === where.defaultType)) runs.push(where);
      }
      return {
        name: f.name,
        description: f.description || '',
        type: f.type || '',
        roles: Array.isArray(f.roles) ? f.roles.map(String) : [],
        runs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── the credentials a form names ────────────────────────────────────────────
// For a credential's Used by tab : the forms that name it, and where. A form names credentials in
// its yaml (credentials, ansibleCredentials, vaultCredentials, awxCredentials, on the form or on a
// step of a multistep), in an enum field's dbConfig, and in its expressions (fnCredentials and the
// functions that take a credential's name). A name built at launch - from a field, `$(env)-db` - is
// reported as dynamic with that pattern, so a credential page can tell whether its name fits it ; a
// name computed in an expression (a variable) has no pattern and is left out.

// the expression functions that take a credential's name, and which of their arguments
// (0-based) : fnCredentials(name, fallbackname) both ; the others one
const CREDENTIAL_ARGS = {
  fnCredentials: [0, 1],
  fnRestBasic: [3],
  fnRestJwtSecure: [3],
  fnParseHtmlWithRegex: [3],
};

// the app's own database, as a query field may name it : no credential of Connections > Credentials
const SELF = '__self__';

/**
 * Whether a credential name is only known at launch : it holds a field placeholder or a template.
 *
 * Args:
 *   name (string): the name as written in the form.
 *
 * Returns:
 *   boolean: true when it is built at launch.
 */
function isDynamicName(name) {
  return /\$\(|\{\{|\$\{/.test(name);
}

/**
 * The arguments of a function call, as written : split on the commas at the call's own level,
 * not inside quotes, brackets or braces.
 *
 * Args:
 *   text (string): the text right after the opening parenthesis of the call.
 *
 * Returns:
 *   string[]: the arguments, trimmed ; the call's closing parenthesis ends them.
 */
function callArguments(text) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === '\\') {
        current += text[++i] ?? '';
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      current += ch;
    } else if ('([{'.includes(ch)) {
      depth++;
      current += ch;
    } else if (')]}'.includes(ch)) {
      if (depth === 0) break;
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * A literal string argument's value : a quoted string without a template in it.
 *
 * Args:
 *   arg (string): the argument, as written.
 *
 * Returns:
 *   object: { name } for a literal name, { dynamic: true } for anything else (a variable, an
 *     expression, a template string), {} for an empty or missing argument.
 */
function literalArgument(arg) {
  if (!arg) return {};
  const m = arg.match(/^(['"`])([\s\S]*)\1$/);
  if (!m) return { dynamic: true };
  const value = m[2].trim();
  if (!value) return {};
  if (m[1] === '`' && value.includes('${')) return { dynamic: true, pattern: value };
  return isDynamicName(value) ? { dynamic: true, pattern: value } : { name: value };
}

/**
 * The credential names an expression uses : the arguments of the functions that take one, and
 * the base64(), password() and username() of fnRestAdvanced's headers.
 *
 * Args:
 *   expression (string): the expression, as written in the form.
 *
 * Returns:
 *   object: { names (string[]), patterns (string[]): the names built at launch from a quoted
 *     template ('$(env)-db'), dynamic (boolean): a name was not a literal }.
 */
export function expressionCredentials(expression) {
  const names = new Set();
  const patterns = new Set();
  let dynamic = false;
  const text = String(expression || '');
  for (const [fn, positions] of Object.entries(CREDENTIAL_ARGS)) {
    const re = new RegExp(`\\b${fn}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const args = callArguments(text.slice(m.index + m[0].length));
      for (const pos of positions) {
        const arg = literalArgument(args[pos]);
        if (arg.name) names.add(arg.name);
        // fnCredentials' fallback is optional : only a name given and not literal is dynamic
        else if (arg.dynamic) {
          dynamic = true;
          if (arg.pattern) patterns.add(arg.pattern);
        }
      }
    }
  }
  if (/\bfnRestAdvanced\s*\(/.test(text)) {
    const re = /\b(?:base64|password|username)\(\s*([^)]+?)\s*\)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (isDynamicName(m[1])) {
        dynamic = true;
        patterns.add(m[1]);
      } else names.add(m[1]);
    }
  }
  return { names: [...names], patterns: [...patterns], dynamic };
}

/**
 * The credentials one form names, and where.
 *
 * Args:
 *   form (object): a form of the full config.
 *
 * Returns:
 *   object: { credentials ([{ name, where }]), dynamic ([{ pattern, where }]) } - where says the
 *     place in the form, such as "credentials: vcenter", "step Deploy: ansibleCredentials", "field
 *     cmdb (dbConfig)" ; pattern is the name as written, `$(env)-db`.
 */
export function credentialsOfForm(form) {
  const credentials = [];
  const dynamic = [];
  const add = (name, where) => {
    if (typeof name !== 'string' || !name.trim() || name.trim() === SELF) return;
    const value = name.trim();
    if (isDynamicName(value)) {
      if (!dynamic.some((d) => d.pattern === value && d.where === where)) dynamic.push({ pattern: value, where });
    } else if (!credentials.some((c) => c.name === value && c.where === where)) {
      credentials.push({ name: value, where });
    }
  };
  // step 1 : the credentials of the form, and of each step of a multistep
  const scopes = [{ item: form, prefix: '' }];
  if (Array.isArray(form?.steps)) {
    for (const step of form.steps) scopes.push({ item: step, prefix: `step ${step?.name || '?'}: ` });
  }
  for (const { item, prefix } of scopes) {
    if (item?.credentials && typeof item.credentials === 'object') {
      for (const [key, name] of Object.entries(item.credentials)) add(name, `${prefix}credentials: ${key}`);
    }
    add(item?.ansibleCredentials, `${prefix}ansibleCredentials`);
    add(item?.vaultCredentials, `${prefix}vaultCredentials`);
    for (const name of [].concat(item?.awxCredentials || [])) add(name, `${prefix}awxCredentials`);
  }
  // step 2 : the fields, a table's or a list's fields included - their dbConfig and expressions
  const walkFields = (fields, prefix = '') => {
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!field || typeof field !== 'object') continue;
      const label = `${prefix}field ${field.name || '?'}`;
      const db = field.dbConfig;
      if (typeof db === 'string') add(db, `${label} (dbConfig)`);
      else if (Array.isArray(db)) db.forEach((n) => add(n, `${label} (dbConfig)`));
      else if (db && typeof db === 'object') add(db.name, `${label} (dbConfig)`);
      for (const key of ['expression', 'query']) {
        if (typeof field[key] !== 'string') continue;
        const used = expressionCredentials(field[key]);
        used.names.forEach((n) => add(n, `${label} (${key})`));
        used.patterns.forEach((pattern) => add(pattern, `${label} (${key})`));
      }
      if (Array.isArray(field.tableFields)) walkFields(field.tableFields, `${label} > `);
    }
  };
  walkFields(form?.fields);
  return { credentials, dynamic };
}

/**
 * The credentials every form names, subforms included (their fields name credentials too).
 *
 * Args:
 *   forms (object[]): the forms of the full config (Form.load(undefined, undefined, true)).
 *
 * Returns:
 *   object[]: each { name, description, type, credentials, dynamic } for the forms that name at
 *     least one credential or build one at launch, sorted by name.
 */
export function formCredentials(forms) {
  return (Array.isArray(forms) ? forms : [])
    .filter((f) => f && f.name)
    .map((f) => ({ name: f.name, description: f.description || '', type: f.type || '', ...credentialsOfForm(f) }))
    .filter((f) => f.credentials.length || f.dynamic.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}
