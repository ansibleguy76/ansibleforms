// The LDAP directories (Settings > Access > LDAP) : the pure rules of their names, of where a
// username is looked up, and of their servers. Free of database and network access, so they are
// unit tested (tests/ldap-directories.test.mjs) ; models/ldap.model.js uses them.

// the directory whose members keep their short names (ldap/<group>, the bare username) : the one
// there was before several could be made. Named "default" up to 7.2 (renamed by the 7.3 schema
// patch, renameDefaultLdap), which read as "default (default)" in the list
export const DEFAULT_NAME = "main";
export const LEGACY_DEFAULT_NAME = "default";
// a directory's name : it prefixes its members (ldap/<name>/<group>, <name>/<user>), so letters,
// digits, - and _ only
export const NAME_RULE = /^[a-z0-9][a-z0-9_-]{0,49}$/i;

// ─── the names of the directories, as qualify reads them ──────────────────────
// qualify runs where no database call can be awaited (and must stay a pure rule), so the names
// of the directories are kept here : models/ldap.model.js sets them each time it reads the
// directories (every sign-in does, before any name is qualified) and after each change.
let directoryNames = new Set();

/**
 * Keeps the names of the existing directories, for qualify.
 *
 * Args:
 *   names (string[]): every directory's name.
 *
 * Returns:
 *   void
 */
export function setDirectoryNames(names) {
  directoryNames = new Set((names || []).filter(Boolean).map((n) => String(n).toLowerCase()));
}

/**
 * A member's name as roles and the app know it : the default directory's as it is, any other's
 * prefixed with the directory (corp/jane, corp/Admins).
 *
 * A name of the default directory whose part before its first '/' is the name of another
 * existing directory has its '/' written %2F : unprefixed, a group named 'corp/Admins' (or a
 * user named 'corp/jane') in the default directory would read exactly as the group Admins (the
 * user jane) of the directory corp, so whoever could name a group or a user in the default
 * directory took the roles another directory's members are given. Any other '/' cannot collide
 * and stays as it was (role mappings such as ldap/Sales/EMEA keep matching, usernames keep
 * their form) ; the directory names are compared regardless of case, as route() reads them.
 *
 * Args:
 *   directory (object): the directory ({ name }).
 *   name (string): the user's or the group's name in the directory.
 *   names (Iterable<string>): the existing directories' names ; by default the ones kept by
 *     setDirectoryNames.
 *
 * Returns:
 *   string: the qualified name.
 */
export function qualify(directory, name, names = directoryNames) {
  const dir = directory?.name || DEFAULT_NAME;
  if (dir !== DEFAULT_NAME) return `${dir}/${name}`;
  if (typeof name !== "string") return name;
  const slash = name.indexOf("/");
  if (slash < 0) return name;
  const head = name.slice(0, slash).toLowerCase();
  const others = new Set([...(names || [])].map((n) => String(n).toLowerCase()));
  others.delete(DEFAULT_NAME.toLowerCase());
  return others.has(head) ? name.replaceAll("/", "%2F") : name;
}

/**
 * Where a username is looked up : the directory it names (corp\jane, corp/jane), the one owning
 * its domain (jane@corp.example), else every enabled directory in order with the name as typed.
 *
 * Args:
 *   username (string): what was typed.
 *   directories (object[]): the enabled directories, in order.
 *
 * Returns:
 *   object[]: [{ directory, username }], the username as each directory is asked for it.
 */
export function route(username, directories) {
  const text = String(username ?? "").trim();
  const named = text.match(/^([^\\/@]+)[\\/](.+)$/);
  if (named) {
    const dir = directories.find((d) => d.name.toLowerCase() === named[1].toLowerCase());
    if (dir) return [{ directory: dir, username: named[2] }];
  }
  const at = text.lastIndexOf("@");
  if (at > 0) {
    const domain = text.slice(at + 1).toLowerCase();
    const owner = directories.find((d) =>
      String(d.domains || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(domain),
    );
    if (owner) return [{ directory: owner, username: text }];
  }
  return directories.map((d) => ({ directory: d, username: text }));
}

/**
 * Whether an ldap failure means the server could not be reached (the next server is tried),
 * rather than an answer from it.
 *
 * Args:
 *   err (any): the error, as ldap-authentication throws it.
 *
 * Returns:
 *   boolean: true when the server was not reached.
 */
export function isUnreachable(err) {
  const code = err?.code || err?.admin?.code || "";
  const text = `${code} ${err?.message || ""} ${err?.admin?.message || ""}`;
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ECONNRESET|EAI_AGAIN|timeout/i.test(text);
}

/**
 * The servers of a directory : one or more, comma (or space) separated, each with the port and the
 * scheme of the directory unless it says its own (ldaps://dc2:3269).
 *
 * Args:
 *   cfg (object): the directory.
 *
 * Returns:
 *   string[]: the urls, in the order they are tried.
 */
export function urls(cfg) {
  const scheme = cfg.enable_tls == 1 ? "ldaps" : "ldap";
  return String(cfg.server || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^ldaps?:\/\//i.test(s) ? s : `${scheme}://${s}${/:\d+$/.test(s) ? "" : `:${cfg.port}`}`));
}
