// The LDAP directories (Settings > Access > LDAP) : the pure rules of their names, of where a
// username is looked up, and of their servers. Free of database and network access, so they are
// unit tested (tests/ldap-directories.test.mjs) ; models/ldap.model.js uses them.

// the directory whose members keep their short names (ldap/<group>, the bare username) : the one
// there was before several could be made
export const DEFAULT_NAME = "default";
// a directory's name : it prefixes its members (ldap/<name>/<group>, <name>/<user>), so letters,
// digits, - and _ only
export const NAME_RULE = /^[a-z0-9][a-z0-9_-]{0,49}$/i;

/**
 * A member's name as roles and the app know it : the default directory's as it is, any other's
 * prefixed with the directory (corp/jane, corp/Admins).
 *
 * Args:
 *   directory (object): the directory ({ name }).
 *   name (string): the user's or the group's name in the directory.
 *
 * Returns:
 *   string: the qualified name.
 */
export function qualify(directory, name) {
  const dir = directory?.name || DEFAULT_NAME;
  return dir === DEFAULT_NAME ? name : `${dir}/${name}`;
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
