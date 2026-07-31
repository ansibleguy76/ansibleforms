'use strict';
import Query from '../../models/query.model.js';
import RestResult from '../../models/restResult.model.js';
import logger from '../../lib/logger.js';
import { resolveQuery, QueryPolicyError } from '../../lib/queryPolicy.js';

/**
 * Runs a query for a form field.
 *
 * This used to take `req.body.query` verbatim and run it. The route is mounted with
 * nothing but `authobj` (app.js), so ANY authenticated user could send arbitrary SQL to
 * any configured datasource and read or write it with the stored credential's privileges,
 * whatever their role options said - and doing it through this older URL bypassed the
 * guard added to /api/v2/query entirely. The client has been on v2 throughout, so nothing
 * in the product relied on the unguarded behaviour.
 *
 * The policy is shared with v2 (lib/queryPolicy.js) so the two cannot drift again. Only
 * the response envelope differs, v1 keeping its own RestResult shape.
 */
const findAll = async function(req, res) {
  //handles null error
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
    return res.status(400).json(new RestResult("error","no data was sent","",""));
  }
  const user = req?.user?.user || {};
  const noLog = (req.query.noLog == "true");

  let resolved;
  try {
    resolved = await resolveQuery(req);
  } catch (err) {
    if (err instanceof QueryPolicyError) {
      if (err.statusCode === 403) {
        logger.warning(`Refused a raw query from ${user.username || 'unknown'} : send formName and fieldName instead`);
        // 403, never 401 : a 401 makes the client's axios interceptor drop the session
        return res.status(403).json(new RestResult("error","no access",null,err.detail));
      }
      if (err.statusCode === 400) {
        logger.error("database config is missing, provide 'dbConfig' parameter with type query");
        return res.status(400).json(new RestResult("error","missing dbConfig",null,""));
      }
      return res.status(err.statusCode).json(new RestResult("error",err.message,null,""));
    }
    // Form.load throws these, and they are answers rather than faults : a 500 hid the
    // reason and made the client report a broken server for a permission or a typo.
    // 403, never 401 - a 401 makes the client's axios interceptor drop the session.
    if (err.name === 'AccessDeniedError') {
      return res.status(403).json(new RestResult("error","no access",null,err.message));
    }
    if (err.name === 'NotFoundError') {
      return res.status(404).json(new RestResult("error",err.message,null,""));
    }
    logger.error("Could not resolve the form query: " + err.toString());
    return res.status(500).json(new RestResult("error","failed to resolve query",null,err.toString()));
  }

  try {
    const resultset = await Query.findAll(resolved.query,resolved.jq,resolved.config,noLog,resolved.values);
    res.json(new RestResult("success","query ran successfully",resultset,""));
  } catch(err) {
    // this said "success" for a failed query, so a caller checking the status field was
    // told the run had worked
    res.status(500).json(new RestResult("error","failed run query",null,err.toString()));
  }
};

export default {
  findAll
};
