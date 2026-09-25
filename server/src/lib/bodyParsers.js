'use strict';
import bodyParser from 'body-parser';
import appConfig from '../../config/app.config.js';

// Request body parsers whose size limit can change without a restart.
//
// body-parser bakes `limit` in when the middleware is created, and app.js installed the
// middleware once at startup - so API_BODY_LIMIT_MB needed a restart. Rebuilding a parser per
// request would fix that at the cost of two allocations on the hot path of every request,
// which is not a trade worth making.
//
// Instead the parsers live here behind a stable pair of middlewares. app.js installs those
// once; the settings page calls rebuild() when the limit changes and the next request uses the
// new parser. The per-request cost is one function call, and nothing is allocated.
let jsonParser;
let urlencodedParser;

export function rebuildBodyParsers() {
  const limit = `${appConfig.apiBodyLimitMb || 50}mb`;
  jsonParser = bodyParser.json({ limit });
  urlencodedParser = bodyParser.urlencoded({ limit, extended: true });
  return true;
}

rebuildBodyParsers();

// Stable references : express keeps whatever it was handed at startup, so the indirection is
// what lets the parser underneath be replaced.
export const jsonBody = (req, res, next) => jsonParser(req, res, next);
export const urlencodedBody = (req, res, next) => urlencodedParser(req, res, next);

export default { rebuildBodyParsers, jsonBody, urlencodedBody };
