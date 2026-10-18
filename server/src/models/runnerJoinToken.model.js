/******************************************************************/
/*                                                                */
/*  Runner join tokens (Connections > Runners > Add runner) : an  */
/*  RTE in outbound mode presents one once (RTE_JOIN_TOKEN) to    */
/*  add itself as a runner, with a token of its own it signs in   */
/*  with from then on. Only the token's SHA-256 is stored : the   */
/*  token is shown once, when it is made. A token may expire,     */
/*  admit a number of runners, and be revoked.                    */
/*                                                                */
/******************************************************************/
import crypto from "crypto";
import mysql from "./db.model.js";
import Errors from "../lib/errors.js";

// the start of every join token, so one pasted elsewhere is recognised (a secret scanner too)
export const JOIN_PREFIX = "afj_";

/**
 * A token's hash, as stored.
 *
 * Args:
 *   token (string): the token.
 *
 * Returns:
 *   string: its SHA-256, hex.
 */
const hashOf = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const RunnerJoinToken = {
  /**
   * Makes a join token.
   *
   * Args:
   *   data (object): { name, expiresInHours (0 or none : never), maxUses (0 or none : any) }.
   *   user (object): who makes it.
   *
   * Returns:
   *   Promise<object>: { id, name, token } - the token, shown this once.
   *
   * Raises:
   *   BadRequestError: no name, or a name taken.
   */
  async create(data, user) {
    const name = String(data?.name || "").trim();
    if (!name || name.length > 100) throw new Errors.BadRequestError("A join token needs a name of at most 100 characters");
    const token = JOIN_PREFIX + crypto.randomBytes(32).toString("base64url");
    const hours = Number(data?.expiresInHours) || 0;
    const maxUses = Number(data?.maxUses) || 0;
    try {
      const res = await mysql.do(
        "INSERT INTO AnsibleForms.`runner_join_tokens` (name, token_hash, prefix, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, " +
          (hours > 0 ? "DATE_ADD(NOW(), INTERVAL ? HOUR)" : "?") + ", ?)",
        [name, hashOf(token), token.slice(0, 12), user?.username || null, hours > 0 ? hours : null, maxUses > 0 ? maxUses : null]
      );
      return { id: res.insertId, name, token };
    } catch (e) {
      if (e?.code === "ER_DUP_ENTRY" || /Duplicate/.test(e?.message || "")) throw new Errors.BadRequestError(`A join token named '${name}' exists already`);
      throw e;
    }
  },

  /**
   * The join tokens, newest first : never the tokens themselves.
   *
   * Returns:
   *   Promise<object[]>: [{ id, name, prefix, created_by, created_at, expires_at, max_uses, uses,
   *     last_used_at, revoked, usable }].
   */
  async findAll() {
    const rows = await mysql.do(
      "SELECT id, name, prefix, created_by, created_at, expires_at, max_uses, uses, last_used_at, revoked, " +
        "(revoked = 0 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses < max_uses)) AS usable " +
        "FROM AnsibleForms.`runner_join_tokens` ORDER BY created_at DESC"
    );
    return (rows || []).map((r) => ({ ...r, revoked: !!r.revoked, usable: !!r.usable }));
  },

  /**
   * Revokes a join token : it adds no runner any more (the runners it added stay).
   *
   * Args:
   *   id (number): the token.
   *
   * Returns:
   *   Promise<boolean>: whether it existed.
   */
  async revoke(id) {
    const res = await mysql.do("UPDATE AnsibleForms.`runner_join_tokens` SET revoked = 1 WHERE id = ?", [id]);
    return (res?.affectedRows || 0) > 0;
  },

  /**
   * Deletes a join token.
   *
   * Args:
   *   id (number): the token.
   *
   * Returns:
   *   Promise<boolean>: whether it existed.
   */
  async remove(id) {
    const res = await mysql.do("DELETE FROM AnsibleForms.`runner_join_tokens` WHERE id = ?", [id]);
    return (res?.affectedRows || 0) > 0;
  },

  /**
   * Uses a join token : counted when it is usable (not revoked, not expired, uses left), in one
   * statement so two RTEs racing for the last use do not both get it.
   *
   * Args:
   *   token (string): the token the RTE presented.
   *
   * Returns:
   *   Promise<object|null>: { id, name } when it was used, null when it is not usable.
   */
  async use(token) {
    if (!String(token || "").startsWith(JOIN_PREFIX)) return null;
    const hash = hashOf(token);
    const res = await mysql.do(
      "UPDATE AnsibleForms.`runner_join_tokens` SET uses = uses + 1, last_used_at = NOW() " +
        "WHERE token_hash = ? AND revoked = 0 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses < max_uses)",
      [hash]
    );
    if (!res?.affectedRows) return null;
    const rows = await mysql.do("SELECT id, name FROM AnsibleForms.`runner_join_tokens` WHERE token_hash = ?", [hash]);
    return rows?.[0] || null;
  },
};

export default RunnerJoinToken;
