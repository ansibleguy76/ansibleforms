/******************************************************************/
/*                                                                */
/*  Two secrets compared in constant time : a token sent by a     */
/*  caller against the one expected (an RTE's token, the metrics  */
/*  token). A plain === stops at the first character that         */
/*  differs, and how long it takes tells a caller how much of a   */
/*  guess was right.                                              */
/*                                                                */
/******************************************************************/
import { timingSafeEqual } from "crypto";

/**
 * Whether two secrets are the same, in constant time. An empty one is never equal to anything :
 * a token not set lets nobody in.
 *
 * Args:
 *   a (string|Buffer): one (what the caller sent).
 *   b (string|Buffer): the other (what is expected).
 *
 * Returns:
 *   boolean: true when both are set and equal.
 */
export function safeEqual(a, b) {
  // both as bytes : a Buffer as it is, anything else as its text
  const x = Buffer.isBuffer(a) ? a : Buffer.from(String(a ?? ""));
  const y = Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? ""));
  // timingSafeEqual needs two of the same length : a length that differs is not equal anyway
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The bearer token of a request's Authorization header, without its scheme.
 *
 * Args:
 *   header (string): the Authorization header ("Bearer abc").
 *
 * Returns:
 *   string: the token, "" when none.
 */
export function bearerToken(header) {
  return String(header || "").replace(/^Bearer\s+/i, "");
}

export default { safeEqual, bearerToken };
