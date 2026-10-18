// ─── HTTP Basic credentials ─────────────────────────────────────────────────────────────────
// The username and password of an "Authorization: Basic <base64>" header, read as RFC 7617
// says : the base64 decodes to UTF-8 text, and the user-id ends at the FIRST colon (a user-id
// may not hold one), so everything after it is the password, colons included.
//
// passport-http read it differently : it split the text on every colon and kept only the
// first two parts, so a password with a colon in it ("a:b:c") reached the check as "b" and
// never matched. The login page sent Latin-1 (btoa), so a name or password with a character
// outside it (an accent outside Latin-1, a CJK character) could not be sent at all ; it now
// sends UTF-8, read here as UTF-8.

import { BasicStrategy as basicStrategy } from 'passport-http';

/**
 * The credentials of a Basic authorization header.
 *
 * Args:
 *   header (string): the Authorization header's value ("Basic dXNlcjpwYXNz").
 *
 * Returns:
 *   object|null: { scheme, username, password } when the header is a Basic one that holds a
 *     colon ; { scheme } alone when it is another scheme ; null when there is no header or
 *     it holds no credentials (no space, no colon).
 */
export function parseBasicCredentials(header) {
  // step 1 : the scheme and the encoded credentials, split on the first run of spaces
  const text = String(header || '').trim();
  if (!text) return null;
  const space = text.search(/\s/);
  if (space < 0) return null;
  const scheme = text.slice(0, space);
  if (!/^Basic$/i.test(scheme)) return { scheme };
  const encoded = text.slice(space).trim();

  // step 2 : the base64 decoded as UTF-8
  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return null;
  }

  // step 3 : the user-id ends at the first colon, the rest is the password
  const sep = decoded.indexOf(':');
  if (sep < 0) return null;
  return { scheme, username: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}

// ─── the Basic header, read as UTF-8 and split on its first colon ───────────────────────────

/**
 * passport-http's BasicStrategy with the header read as RFC 7617 says (parseBasicCredentials) :
 * the credentials decoded as UTF-8, the user-id ended at the first colon, the password all the
 * rest. passport-http split on every colon and dropped what came after the second one, so a
 * password holding a colon never matched. The answers are passport-http's own : a challenge
 * without credentials, 400 for a header that holds none.
 */
export class Utf8BasicStrategy extends basicStrategy {
  /**
   * Reads the credentials of the request and hands them to the verify function.
   *
   * Args:
   *   req (object): the express request.
   */
  authenticate(req) {
    // step 1 : no header, the challenge ; another scheme, the challenge ; no colon, 400
    const header = req.headers['authorization'];
    if (!header) return this.fail(this._challenge());
    const credentials = parseBasicCredentials(header);
    if (!credentials) return this.fail(400);
    if (credentials.username === undefined) return this.fail(this._challenge());
    const { username, password } = credentials;
    if (!username || !password) return this.fail(this._challenge());

    // step 2 : the verify function decides, its answer turned into passport's
    const verified = (err, user) => {
      if (err) return this.error(err);
      if (!user) return this.fail(this._challenge());
      this.success(user);
    };
    if (this._passReqToCallback) this._verify(req, username, password, verified);
    else this._verify(username, password, verified);
  }
}

export default { parseBasicCredentials, Utf8BasicStrategy };
