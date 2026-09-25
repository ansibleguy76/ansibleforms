import express from 'express';
import passport from 'passport';
import schemaController from '../../controllers/v2/schema.controller.js';
import Schema from '../../models/schema.model.js';
import Middleware from '../../lib/middleware.js';
import RestResult from '../../models/restResult.model.v2.js';
import logger from '../../lib/logger.js';

const router = express.Router();

// POST /schema runs create_schema_and_tables.sql, which DROPs every table before
// recreating it : left open, that is unauthenticated total data loss on any
// reachable instance (and ALLOW_SCHEMA_CREATION defaults to on). It is also the
// documented bootstrap step against an empty database, where there is no account
// to authenticate as yet - so requiring auth unconditionally would break a fresh
// install. Instead it stays open exactly as long as the database has nobody to
// authenticate against, and needs an authenticated admin the moment it has one
// (see Schema.isProvisioned). GET /schema stays public : the SPA polls it on
// every page load and it only reports state.
const guardSchemaCreation = async function (req, res, next) {
  var provisioned
  try {
    provisioned = await Schema.isProvisioned()
  } catch (err) {
    // a database we can not question is not proof of a fresh install : refuse
    logger.error(`Failed to determine whether the database is provisioned : ${err.message || err}`)
    return res.status(500).json(RestResult.error("Failed to check the database state", `${err.message || err}`))
  }
  if (!provisioned) {
    logger.warning("Database is not provisioned yet, allowing the schema bootstrap without authentication")
    return next()
  }
  // the custom callback keeps passport from answering with its bare 'Unauthorized' :
  // a previously open endpoint now refusing has to say why
  return passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err || !user) {
      logger.warning("Refused an unauthenticated schema creation on a provisioned database")
      return res.status(401).json(RestResult.error(
        "Schema creation requires an authenticated administrator",
        "This database is already provisioned. Creating the schema drops and recreates every table, so it can only run unauthenticated on a fresh install (no schema yet, or no user accounts to authenticate as)."))
    }
    req.user = user
    return Middleware.checkAdminMiddleware(req, res, next)
  })(req, res, next)
}

// check the database schema
router.get('/', schemaController.hasSchema);
// create the database schema
router.post('/', guardSchemaCreation, schemaController.create);

export default router
