'use strict';
/******************************************************************/
/*                                                                */
/*  What a failure tells the caller. A database error carries the */
/*  statement it failed on, or part of it, and the names of the   */
/*  tables, columns and keys ("Duplicate entry 'x' for key        */
/*  'jobs.name'", "... near 'WHERE ...'") : handed back in a 500, */
/*  it described the schema to whoever caused it. The detail is   */
/*  logged on the server ; the caller is told a database error    */
/*  occurred. Any other failure is told as it was.                */
/*                                                                */
/******************************************************************/
import Errors from '../../lib/errors.js';
import i18n from '../../lib/i18n.js';
import logger from '../../lib/logger.js';

/**
 * Whether an error comes from the database driver (mysql2) : it carries an SQL state, the SQL
 * message, the statement, or an ER_ code.
 *
 * Args:
 *   err (any): the error.
 *
 * Returns:
 *   boolean: true for a database error.
 */
export function isDatabaseError(err) {
  if (!err || typeof err !== 'object' || err instanceof Errors.ApiError) return false;
  return err.sqlMessage !== undefined || err.sqlState !== undefined || err.sql !== undefined
    || (typeof err.code === 'string' && /^ER_/.test(err.code));
}

/**
 * The error to answer with : a database error logged and replaced by a generic one (a 500), any
 * other as it is.
 *
 * Args:
 *   req (object): the request (its language).
 *   err (any): the error.
 *
 * Returns:
 *   any: the error to hand to Errors.ReturnError.
 */
export function publicError(req, err) {
  if (!isDatabaseError(err)) return err;
  logger.error(`Database error answered as a generic one: ${err.code || ''} ${err.sqlMessage || err.message || ''}`);
  return new Error(i18n.t(req, 'errors.databaseError'));
}

/**
 * The text of a failure as a 500 tells it : a database error's generic text, any other as
 * err.toString() told it before.
 *
 * Args:
 *   req (object): the request (its language).
 *   err (any): the error.
 *
 * Returns:
 *   string: the text to answer with.
 */
export function publicMessage(req, err) {
  if (isDatabaseError(err)) return publicError(req, err).message;
  return err?.toString ? err.toString() : String(err);
}

export default { isDatabaseError, publicError, publicMessage };
