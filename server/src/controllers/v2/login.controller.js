'use strict';
import User from "../../models/user.model.js";
import Token from "../../models/token.model.js";
import EntraId from "../../models/entraId.model.js";
import OAuth2 from "../../models/oauth2.model.js";
import OIDC from "../../models/oidc.model.js";
import passport from 'passport';
import jwt from 'jsonwebtoken';
import authConfig from '../../../config/auth.config.js';
import appConfig from '../../../config/app.config.js';
import logger from "../../lib/logger.js";
import helpers from '../../lib/common.js';
import { signHandoff, openToken } from '../../lib/ssoHandoff.js';
import { fetchEntraGroups, filterGroups } from '../../lib/entraGraph.js';
import RestResult from "../../models/restResult.model.v2.js";
import auth_oidc from "../../auth/auth_oidc.js";
import { isSingleTenant } from "../../auth/auth_entraid.js";
import i18n from "../../lib/i18n.js";
import Audit from "../../models/audit.model.js";
import { claimsDisplayName } from "../../lib/displayName.js";
import { loginBlocked, loginFailed, loginSucceeded } from "../../lib/loginThrottle.js";
import { newSessionId, revokeSession, consumeOnce } from "../../lib/tokenRevocation.js";
import { NEVER_DAYS, apiTokenDays, revocationHorizonSeconds } from "../../lib/tokenLifetime.js";
import { admitSignIn } from "../../lib/signInGate.js";
import { tokenUser, forgetGroups } from "../../lib/userGroups.js";
import ApiToken from "../../models/apiToken.model.js";

// Login is audited here rather than by the blanket middleware, which deliberately
// skips /auth : on a failed attempt there is no req.user, so that layer could only
// record an anonymous 'auth.login' - and a failed-login trail that does not say
// WHICH account was tried is of no use to anyone. The actor is the attempted
// username, which is the honest answer for both outcomes.
// Fire and forget : never let this delay or break a login.
//
// The credentials arrive as an http Basic header, not a json body (see
// client/src/pages/login.vue), so the attempted username has to be decoded from it
// - req.body is empty on every login. Only the half before the colon is ever read;
// the password half is never assigned to anything.
function attemptedUsername(req) {
  const header = req.headers?.authorization || '';
  const m = /^Basic\s+(.+)$/i.exec(header.trim());
  if (m) {
    try {
      const decoded = Buffer.from(m[1], 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      const name = sep >= 0 ? decoded.slice(0, sep) : decoded;
      if (name) return name;
    } catch {
      // an unparsable header is still an attempt worth recording, just anonymously
    }
  }
  // other clients may post a body instead
  return req.body?.username || null;
}

function auditLogin(req, outcome, type, reason, resolvedUsername) {
  // on success the resolved account is authoritative (it may differ in case from
  // whatever was typed) ; on failure the attempted name is all there is
  const username = resolvedUsername || attemptedUsername(req);
  Audit.log({
    user: username ? { username, type: type || 'unknown' } : null,
    ip: req.ip,
    action: 'auth.login',
    outcome,
    targetType: 'user',
    target: username,
    detail: reason ? { reason } : null,
  });
}

function hasValidLoginOption(user) {
  if(user.options.allowLogin === false) {
    logger.warning(`Login is disabled for user '${user.username}' in the configuration (allowLogin option is set to false), please check your settings`)
    return false;
  } 
  return true;
}

/**
 * The last check of a sign-in (lib/signInGate.js) : refused, audited and answered when an admin
 * blocked the user ; else it goes on (an LDAP or SSO user recorded for its page in Settings >
 * Users).
 *
 * Args:
 *   req (object): the request, for the audit entry.
 *   res (object): the response : the refusal is sent on it.
 *   user (object): the signed-in user.
 *   extra (object): what the record keeps that the token does not carry.
 *
 * Returns:
 *   Promise<boolean>: true when the sign-in may go on ; false once refused (answered).
 */
async function admitUser(req, res, user, extra = {}) {
  if (await admitSignIn(user, extra)) return true;
  auditLogin(req, 'denied', user.type, 'sign-in blocked', user.username);
  res.status(401).json({ error: i18n.t(req, 'auth.signInBlocked') });
  return false;
}

/**
 * The tokens of a sign-in, or an api token (expiryDays, for a role with allowApiTokens or
 * extendedTokenExpiration ; 'never' for one that never expires, the extended one only).
 *
 * Args:
 *   user (object): the user signed in.
 *   expiryDays (number|string): an api token's lifetime in days, or 'never' ; none for a session.
 *   options (object): { name, authTime, strict } - an api token's name ; when its user last
 *     proved who they are (unix seconds), else now (a password just checked), or null for none (an
 *     SSO sign-in the provider may have answered without asking anything) ; strict : an api token
 *     that could not be recorded is not handed out (it could not be revoked on its own).
 *
 * Returns:
 *   Promise<object>: { token, refreshtoken } ; an api token's expiry too (expires_at).
 */
export async function userToJwt(user,expiryDays,{ name, authTime, strict = false } = {}){

  // is something like
  // {"username":"administrator","type":"local","roles":["default","admin"]}

  var tokenExpiresIn
  // an api token (a script's, asked with expiryDays) : no one to accept the disclaimer, so it
  // passes its gate (Middleware.disclaimerGate)
  var api = false

  // bounded : an api token lives API_TOKEN_MAX_DAYS at most (or NEVER_DAYS, one that never
  // expires), and a password change or a logout of its session ends it sooner
  // (lib/tokenRevocation.js) ; a user without the role option gets a session's tokens
  const days = expiryDays ? apiTokenDays(user, expiryDays) : null
  if(days){
    tokenExpiresIn = `${days}d`
    api = true
    logger.info(`Api token (${days === NEVER_DAYS ? 'never expires' : `${days} days`}) requested for ${user.username}`)
  }else{
    tokenExpiresIn = authConfig.jwtExpiration
  }

  // The tokens carry the user WITHOUT its groups. They are sent on every request, and an
  // Entra ID user in a hundred groups (each one twice : its object id and its name) made them
  // larger than the 16 KB a request header may be : every api call was refused with 431
  // (#1036). The roles and options resolved from the groups are in the token ; the groups stay
  // where the sign-in put them (the local user's groups, a directory user's record) and the
  // server puts them back on req.user.user (lib/userGroups.js). This sign-in may have changed
  // them : the cached ones are forgotten.
  const claims = tokenUser(user)
  forgetGroups(user.type, user.username)

  // we create 2 jwt tokens (accesstoken and refresh token)
  // the session : both tokens and every refresh of them carry it, so a logout ends them all
  const sid = newSessionId()
  // when its user signed in (unix seconds), kept through the refreshes : an api token is made
  // from a session only shortly after a sign-in (apiToken.controller.js)
  const auth_time = authTime === null ? undefined : Number(authTime) || Math.floor(Date.now() / 1000)
  const token = jwt.sign(api ? {user:claims,access:true,sid,api:true,auth_time} : {user:claims,access:true,sid,auth_time}, authConfig.secret,{ expiresIn: tokenExpiresIn, issuer: authConfig.jwtIssuer});
  const refreshtoken = jwt.sign({user:claims,refresh:true,sid,auth_time}, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration, issuer: authConfig.jwtIssuer});
  // an api token is listed on its user's profile and page, to be revoked there
  let expires_at
  if (api) {
    const { iat, exp } = jwt.decode(token)
    expires_at = new Date(exp * 1000)
    // a failure is logged : the token works, it is only missing from the list (a password change
    // or a block still ends it)
    try {
      await ApiToken.record({ sid, username: user.username, type: user.type || 'local', name, createdAt: new Date(iat * 1000), expiresAt: expires_at })
    } catch (err) {
      logger.error(`Failed to record the api token of ${user.username}: ${err}`)
      if (strict) {
        await revokeSession(sid, expires_at.getTime())
        throw err
      }
    }
  }
  logger.debug(JSON.stringify(claims))
  // we store the tokens in the database, to later verify a refresh token action
  logger.info("Storing refreshtoken in database for user " + user.username)
  // awaited : the client may refresh as soon as it has the tokens, and a refresh that came
  // before the row was refused as an unknown token (#1062). A failure is logged, the sign-in
  // goes on as before, only its refresh will be refused.
  try {
    await Token.store(user.username,user.type,refreshtoken)
  } catch (err) {
    logger.error(`Failed to store token for ${user.username}: ${err}`)
  }
  return api ? { token, refreshtoken, expires_at } : { token, refreshtoken }
}
// get login settings
const settings = async function(req, res) {
  try {
    const [entraRaw, oidcRaw] = await Promise.all([
      EntraId.isEnabled().catch(() => ({ enable: 0, groupfilter: null })),
      OIDC.isEnabled().catch(() => ({ enable: 0, issuer: null, groupfilter: null }))
    ]);

    // Normalize shapes regarding enable vs enabled
    const entra = {
      enable: !!entraRaw.enable,
      groupfilter: entraRaw.groupfilter,
    };

    const oidc = {
      enabled: !!oidcRaw.enable,
      issuer: oidcRaw.issuer,
      groupfilter: oidcRaw.groupfilter,
    };
    const skipTo = await OAuth2.autoLoginProvider();
    // the enabled provider set to Skip the login page, the login page goes straight to it
    const usable = { azuread: entra.enable, oidc: oidc.enabled };
    const autoLogin = skipTo && usable[skipTo] ? skipTo : null;
    const settings = {
      entraIdEnabled: entra.enable,
      entraGroupfilter: entra.groupfilter,
      entraGraphUrl: authConfig.entraGraphUrl,
      // the names of before 7.3, for a caller that still reads them (removed in 8.0)
      azureAdEnabled: entra.enable,
      azureGroupfilter: entra.groupfilter,
      azureGraphUrl: authConfig.entraGraphUrl,
      oidcEnabled: oidc.enabled,
      oidcIssuer: oidc.issuer,
      oidcGroupfilter: oidc.groupfilter,
      // the login page goes straight to a provider : the enabled one set to Skip the login page
      ssoAutoLogin: !!autoLogin,
      ssoAutoLoginProvider: autoLogin,
      // the profile page offers api token lifetimes up to this cap (API_TOKEN_MAX_DAYS)
      apiTokenMaxDays: authConfig.apiTokenMaxDays
    };
    res.json(RestResult.single(settings));
  } catch (err) {
    res.status(500).json(RestResult.error(helpers.getError(err)));
  }
}
// basic authentication with local users
const basic = async function(req, res,next) {
    // a locked account, or an address that failed too often, is refused before any password is
    // checked (lib/loginThrottle.js) : the same answer whether the account exists or not
    const blocked = await loginBlocked(attemptedUsername(req), req.ip).catch(() => ({ blocked: false }));
    if (blocked.blocked) {
      auditLogin(req, 'denied', 'unknown', 'too many failed logins');
      res.setHeader('Retry-After', String((blocked.minutes || 1) * 60));
      return res.status(429).json(RestResult.error(i18n.t(req, 'auth.authFailed'), i18n.t(req, 'auth.tooManyFailures', { minutes: blocked.minutes || 1 })));
    }

    // as login, we authenticate against our passport basic (username and password are extracted by passport)
    // in auth.js the user is searched locally and eventually returns either an error or the user
    passport.authenticate(
      'basic',
      async (err, user) => {
        try {
          // if we have an error; we return it
          var e=helpers.getError(err)
          if (e || !user) {
            // basic authentication returned no result, move to next middleware (ldap)
            // e is undefined when passport simply found no credentials (getError(null)
            // returns undefined), so this must be guarded : unguarded it threw a
            // TypeError that the catch below swallowed, leaving the request hanging
            // open for ever. Every login POST that sent a json body instead of a
            // Basic header leaked a socket that way.
            if(e && e.includes('not found')){
              // store error message if ldap is not enabled
              res.locals.basic_authentication_error=e
              return next()
            }
            if(err){
              logger.error(e)
            }
            
            auditLogin(req, 'failure', 'local', e || 'invalid credentials');
            await loginFailed(attemptedUsername(req), req.ip);
            // The specific reason stays on the server. Returning `e` told the caller
            // WHICH half failed - "user not found" for an unknown name against "wrong
            // password" for a real one - so the login form was a username oracle. The
            // reason is in the log and in the audit trail, where an operator can see it
            // and an attacker cannot.
            if (e) logger.debug(`Local authentication failed: ${e}`);
            return res.status(401).json(RestResult.error(i18n.t(req, 'auth.authFailed'), i18n.t(req, 'auth.invalidCredentials')));
          }
          // we found a user (local or ldap) with correct password; we start the login process (a function attached by passport !)
          // http://www.passportjs.org/docs/login/
          req.login(
            user,
            { session: false },
            async (error) => {
              if (error){
                logger.error(helpers.getError(error))
                //return next(error);
              }
              if(!hasValidLoginOption(user)){
                auditLogin(req, 'denied', user.type, 'login disabled for this user', user.username);
                return res.status(401).json({ error: i18n.t(req, 'auth.loginDisabled') });
              }
              // blocked by an admin : refused
              if (!(await admitUser(req, res, user))) return;
              auditLogin(req, 'success', user.type, null, user.username);
              await loginSucceeded(attemptedUsername(req));
              // send the tokens to the requester
              return res.json(await userToJwt(user,req.query.expiryDays,{ name: typeof req.query.name === "string" ? req.query.name.trim() : "" }));
            }
          );
        } catch (error) {
          logger.error(helpers.getError(error))
          // ALWAYS answer. Logging alone left the client waiting on a socket that was
          // never written to and never closed.
          if (!res.headersSent) {
            return res.status(500).json(RestResult.error(i18n.t(req, 'auth.authFailed'), helpers.getError(error)));
          }
        }
      }
    )(req, res, next);
};

// basic authentication with LDAP users
const basic_ldap = async function(req, res,next) {
  // as login, we authenticate against our passport basic (username and password are extracted by passport)
  // in auth.js the user is searched in ldap and eventually returns either an error or the user
  passport.authenticate(
    'ldap',
    async (err, user) => {
      try {
        // if we have an error; we return it
        var e=helpers.getError(err)
        if (e || !user) {
          let reason = e;
          if(e && e.includes("No ldap configured")){
            reason = res.locals.basic_authentication_error || "Authentication failed";
          }
          // the end of the chain : local said 'not found' and fell through to here,
          // so this is the final verdict for the attempt
          auditLogin(req, 'failure', 'ldap', reason || 'invalid credentials');
          await loginFailed(attemptedUsername(req), req.ip);
          // Generic answer, same as the local branch above: `reason` distinguishes an
          // unknown username from a wrong password, and also carries ldap internals
          // (bind failures, server names) that no anonymous caller should see.
          if (reason) logger.debug(`Ldap authentication failed: ${reason}`);
          return res.status(401).json(RestResult.error(i18n.t(req, 'auth.authFailed'), i18n.t(req, 'auth.invalidCredentials')));
        }
        // we found a user (local or ldap) with correct password; we start the login process (a function attached by passport !)
        // http://www.passportjs.org/docs/login/
        req.login(
          user,
          { session: false },
          async (error) => {
            if (error){
              logger.error(helpers.getError(error))
              return next(error);
            }
          
            if(!hasValidLoginOption(user)){
              auditLogin(req, 'denied', user.type, 'login disabled for this user', user.username);
              return res.status(401).json({ error: i18n.t(req, 'auth.loginDisabled') });
            }
            // blocked by an admin : refused ; else recorded for its page in Settings > Users
            if (!(await admitUser(req, res, user))) return;
            auditLogin(req, 'success', user.type, null, user.username);
            await loginSucceeded(attemptedUsername(req));
            // send the tokens to the requester
            return res.json(await userToJwt(user,req.query.expiryDays,{ name: typeof req.query.name === "string" ? req.query.name.trim() : "" }));
          }
        );
      } catch (error) {
        logger.error(helpers.getError(error))
        return next(error);
      }
    }
  )(req, res, next);
};

/**
 * perform logout actions
 */
const logout = async function(req, res, _next){
  // the session of the token that logs out ends here, for every token of it : the access token
  // (still valid for its lifetime otherwise), the refresh token, an api token of that login
  try {
    const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
    if (bearer) {
      const payload = jwt.verify(bearer, authConfig.secret, { issuer: authConfig.jwtIssuer, ignoreExpiration: true })
      if (payload?.sid) await revokeSession(payload.sid, Date.now() + revocationHorizonSeconds() * 1000)
      const refreshtoken = req.body?.refreshtoken
      if (refreshtoken && payload?.user?.username) await Token.delete(payload.user.username, payload.user.type, refreshtoken)
    }
  } catch (err) {
    logger.debug(`Logout: the token could not be read, nothing revoked: ${err.message || err}`)
  }
  req.logout((err) => {
    if (err) {
      logger.error(helpers.getError(err))
      return res.status(500).json(RestResult.error(helpers.getError(err)));
    }
    res.json(RestResult.single({logoutUrl: auth_oidc.getLogoutUrl()}))
  });
};

/**
 * What went wrong with a single sign-on, in the provider's words. openid-client wraps the
 * provider's answer - ResponseBodyError when the token endpoint refused the code,
 * AuthorizationResponseError when the provider sent the browser back with an error - and its
 * own message says only that ("server responded with an error in the response body"). The
 * reason is in the provider's error and error_description : Entra ID's AADSTS code and text
 * (an expired client secret, a redirect URI it does not know, a consent not granted...).
 *
 * Args:
 *   err (Error|string): what passport or openid-client threw.
 *
 * Returns:
 *   string: the provider's description (its first line : Entra ID adds a trace and
 *     correlation id), or its error code, or the error's own message.
 */
export function ssoErrorMessage(err) {
  const description = typeof err?.error_description === 'string' ? err.error_description.split(/\r?\n/)[0].trim() : '';
  if (description) return description;
  if (typeof err?.error === 'string' && err.error) return err.error;
  return helpers.getError(err) || 'Single sign-on failed';
}

// catches middleware error (non implemented strategy for example) : back to the login page,
// with the provider's reason, encoded as a query value
const errorHandler = async function(err,req, res,_next) {
  res.redirect(`${appConfig.baseUrl}/login?error=${encodeURIComponent(ssoErrorMessage(err))}`)
};

/**
 * generate the callback options for login via identity provider oauth2
 * 
 * Some information about how the identity provide mechanism works:
 * 
 * 1. The user clicks on the identity provider login button
 * 2. A browser storage authIssuer key is set with the identity provider name (azuread, oidc, ...)
 * 3. The user is redirected to the ansibleforms backend server identity provider api https://ansibleformsurl/auth/entraid or https://ansibleformsurl/auth/oidc, ...
 * 4. The backend uses passport to authenticate the user with the identity provider and redirects the user away to the identity provider (microsft, google, ...)
 * 5. The identity provider authenticates the user and redirects the user back to the callback url https://ansibleformsurl/auth/entraid/callback (the provider's redirect uri : /auth/azureadoauth2/callback when saved before 7.3) or https://ansibleformsurl/auth/oidc/callback
 * 6. The backend server receives the callback and uses passport to verify the returned payload.  it passes the payload to an authCallback function
 * 7. The authCallback function redirects the user back into the app with a HANDOFF token in the fragment (/#token=), signed by us ; the app swaps it before it draws (client lib/ssoReturn.js) : the claims the login needs, and for azuread the provider's access token sealed inside it (lib/ssoHandoff.js).
 * 8. The frontend posts the handoff token to the backend /auth/entraid/login (or /auth/oidc/login) endpoint.
 * 9. For azuread the backend opens the sealed access token and fetches the user's groups from Microsoft Graph, filtered with the provider's group filter (lib/entraGraph.js). For oidc the groups are a claim of the profile, filtered with the same group filter.
 * 10. The backend grabs more information from payload if needed (username,...) and assembles a user-object, the roles and options are added
 * 11. The backend converts the user object to json and signs it as a jwt token an returns it in the response
 * 12. The frontend grabs the token and stores it in the local storage, ready for jwt-bearer authentication
 * 
 */
// how long a sign-in asked for again may take at the provider
const REAUTH_WINDOW_MS = 10 * 60 * 1000

/**
 * The options of the redirect to the provider : ?reauth=1 (the profile, for an api token) asks the
 * provider for the credentials again (prompt=login) and marks it in the sign-in's session, so the
 * callback can say so ; any other sign-in forgets an older mark.
 *
 * Args:
 *   req (object): the request.
 *
 * Returns:
 *   object: the passport.authenticate options.
 */
export function ssoStart(req) {
  const reauth = req.query?.reauth === '1'
  if (req.session) {
    if (reauth) req.session.afReauth = Date.now()
    else delete req.session.afReauth
  }
  return reauth ? { prompt: 'login' } : {}
}

export const authCallback = function(req, res, next, type) {
  return async (err, payload) => {
    // The HANDOFF token : the claims passport just verified, re-signed with OUR secret
    // (lib/ssoHandoff.js explains why). Signed inside the try and only without an error :
    // a failing sign used to be an unhandled rejection, and the browser was never
    // redirected (#542).
    try {
      if (err) {
        // the provider's reason, and the code it goes with, in the log as on the login page
        logger.error(`${type} sign-in failed: ${ssoErrorMessage(err)}${err?.error ? ` (${err.error})` : ''}`)
        return next(err)
      }
      // no error and no user : the strategy failed the sign-in (a state that does not match,
      // a callback without a code). It used to mint a handoff without claims, and the login
      // page failed later on it with nothing to say why
      if (!payload) {
        const reason = new Error('The identity provider did not sign you in - start again from the login page')
        logger.error(`${type} sign-in failed: no user from the identity provider`)
        return next(reason)
      }
      // a sign-in asked for again (?reauth=1, prompt=login) : said so in the handoff, once
      const asked = Number(req.session?.afReauth) || 0
      if (req.session) delete req.session.afReauth
      const token = signHandoff(payload, type, { reauth: !!asked && Date.now() - asked < REAUTH_WINDOW_MS });
      // in the fragment : the browser keeps it, no server, proxy or access log ever sees it. Into
      // the app, not the login page : the app takes the handoff before it draws anything
      // (client main.js), so the user goes from the provider straight to the page they wanted
      res.redirect(`${appConfig.baseUrl}/#token=${token}`)
    } catch (err) {
      logger.error(helpers.getError(err))
      return next(err)
    }
  }
};


/**
 * Verifies a handoff token minted by authCallback. Throws if it was not signed by us,
 * has expired, or was issued for a different provider - which also stops an ACCESS token
 * being replayed here, since it carries no matching `sso` claim.
 */
async function verifyHandoff(token, type) {
  if (!token) throw new Error('No token given');
  const payload = jwt.verify(token, authConfig.secret, { issuer: authConfig.jwtIssuer });
  if (payload.sso !== type) throw new Error('This token was not issued for this login method');
  // once : a handoff that was seen (a browser history, a shared link) is worth nothing
  if (!payload.jti || !(await consumeOnce(`handoff:${payload.jti}`, (Number(payload.exp) || 0) * 1000))) {
    throw new Error('This login token was used already');
  }
  return payload;
}

/**
 * A login method that is switched off must not be a way in. Both endpoints are
 * unauthenticated, and neither used to check this at all.
 */
async function assertProviderEnabled(model, name) {
  const row = await model.isEnabled().catch(() => null);
  if (!row || !row.enable) throw new Error(`${name} login is not enabled`);
  return row;
}

/**
 * The Entra ID groups, by name, from Graph - with the access token the handoff carries
 * sealed. A handoff without one (minted before 6.5.3) falls back to the groups claim.
 */
async function entraGroups(payload, groupfilter) {
  if (!payload.at) return filterGroups(ssoGroups(payload, 'azuread'), groupfilter);
  const groups = await fetchEntraGroups(openToken(payload.at), authConfig.entraGraphUrl, { withIds: true });
  // the group filter is on the names, as it always was ; a kept group is known by its object id
  // (unique, the way to name it in a role) and by its name (as roles named it before 7)
  const keptNames = new Set(filterGroups(groups.map((g) => g.name), groupfilter));
  const kept = groups.filter((g) => keptNames.has(g.name));
  logger.debug(`azuread login: ${groups.length} groups from Graph, ${kept.length} after the group filter`);
  return [...new Set(kept.flatMap((g) => [g.id, g.name].filter(Boolean)))];
}

/**
 * The groups to trust : the provider's claim, inside the handoff we signed, and nothing else.
 * The list the browser posts (`req.body.groups`) is never read : it used to stand in when
 * the provider sent no groups claim, and a caller could then name any group and be granted
 * the roles that match it - with the handoff from the login page, from any account. No
 * claim is no groups, and the provider is to be configured to emit them. The caller passes
 * the result through the provider's group filter (filterGroups).
 */
function ssoGroups(payload, type) {
  if (Array.isArray(payload.groups)) return payload.groups;
  logger.warning(`${type} login: the provider returned no groups claim, the user gets no groups - configure the provider to emit groups`);
  return [];
}

const extractEntraUser = async function(payload, groups) {
  return {
    // the upn when the token has it (an access token, or an ID token with the optional claim),
    // else the preferred username - the same value for a work account
    username: payload.upn || payload.preferred_username,
    id: payload.oid,
    // the person's name from the token, for the header (see lib/displayName.js)
    ...(claimsDisplayName(payload) && { displayName: claimsDisplayName(payload) }),
    groups: groups.map(g => `azuread/${g}`) // groups are prefixed with azuread/ to avoid conflicts with oidc groups etc
  }
};

const extractOidcUser = async function(payload, groups) {
  return {
    username: payload.preferred_username,
    ...(claimsDisplayName(payload) && { displayName: claimsDisplayName(payload) }),
    groups: groups.map(g => `oidc/${g}`) // groups are prefixed with oidc/ to avoid conflicts with azuread groups etc
  }
};

// this redirects to Microsoft Entra ID login but with the proper application client id & secret
const entraid = async function(req, res,next) {
  logger.debug("Redirect to Microsoft Entra ID")
  // redirect to Microsoft Entra ID
  try {
    passport.authenticate('entraid', ssoStart(req))(req,res,next)
  } catch(err) {
    logger.error(`Microsoft Entra ID redirect failed: ${err?.message || err}`)
    next(err)
  }
};

// callback with the Microsoft Entra ID access token
const entraidCallback = async function(req, res,next) {
  logger.debug("Microsoft Entra ID callback")
  try {
    passport.authenticate('entraid', authCallback(req, res, next,"azuread"))(req, res, next)
  } catch(err) {
    logger.error(`Microsoft Entra ID callback failed: ${err?.message || err}`)
    next(err)
  }
};
// callback with the Microsoft Entra ID user info (including groups)
const entraidLogin = async function(req, res,_next) {
  try {
    logger.debug("Microsoft Entra ID login")
    const payload = await verifyHandoff(req.body.token, 'azuread')
    const provider = await assertProviderEnabled(EntraId, 'azuread')
    // the tenant once more, at the login itself : the handoff of a login against another tenant
    // is refused even if the strategy was reconfigured meanwhile
    const entraConfig = await EntraId.find()
    if (!isSingleTenant(entraConfig.tenant_id)) throw new Error('Microsoft Entra ID login needs the tenant id of your tenant')
    if (payload.tid && /^[0-9a-f-]{36}$/i.test(String(entraConfig.tenant_id).trim()) && String(payload.tid).toLowerCase() !== String(entraConfig.tenant_id).trim().toLowerCase()) {
      throw new Error('This Microsoft Entra ID login is of another tenant')
    }
    const user = await extractEntraUser(payload, await entraGroups(payload, provider.groupfilter))
    user.type = "azuread"
    const ro = await User.getRolesAndOptions(user.groups,user)
    user.roles = ro.roles
    user.options = ro.options  
    if(!hasValidLoginOption(user)){
      auditLogin(req, 'denied', 'azuread', 'login disabled for this user', user.username);
      return res.status(401).json({ error: i18n.t(req, 'auth.loginDisabled') });
    }
    // blocked by an admin : refused ; else recorded for its page in Settings > Users
    if (!(await admitUser(req, res, user, { email: payload.email }))) return;
    // Audited like every other way in. These two paths recorded NOTHING - and /auth is
    // deliberately skipped by the blanket middleware, so an SSO login left no trace at all,
    // successful or refused. The audit trail is the control that would surface a problem here.
    auditLogin(req, 'success', 'azuread', null, user.username);
    // a recent sign-in (for an api token) only when the provider asked for the credentials again
    res.json(await userToJwt(user, undefined, { authTime: payload.reauth ? undefined : null }))

  } catch(err){
    logger.error(helpers.getError(err))
    return res.status(401).json(RestResult.error(i18n.t(req, 'auth.entraFailed'), helpers.getError(err)));
  }
};

// this redirects to OIDC Provider login but with the proper application client id & secret
const oidc = async function(req, res,next) {
  logger.debug("Redirect to Open ID Issuer")
  // redirect to Open ID Connect Provider
  passport.authenticate('oidc', ssoStart(req))(req,res,next)
};

// callback with the OIDC access token
const oidcCallback = async function(req, res,next) {
  passport.authenticate('oidc', authCallback(req, res, next, 'oidc'))(req, res, next)
};
// callback with the OIDC user info (including groups)
const oidcLogin = async function(req, res, _next) {
  try {
    const payload = await verifyHandoff(req.body.token, 'oidc')
    const provider = await assertProviderEnabled(OIDC, 'oidc')
    // The provider's group filter is applied HERE, on the groups we trust (the claim in the
    // handoff). It used to be applied only by the browser, to a list it posted and the
    // server ignored whenever the token carried a groups claim, so the filter had no effect
    // at all and every group of the user ended up in the jwt. Same semantics as Entra ID
    // and LDAP : a regular expression, an invalid one keeps every group and is logged.
    const groups = filterGroups(ssoGroups(payload, 'oidc'), provider.groupfilter)
    logger.debug(`oidc login: ${groups.length} groups after the group filter`)
    const user = await extractOidcUser(payload, groups)
    user.type = "oidc"
    const ro = await User.getRolesAndOptions(user.groups,user)
    user.roles = ro.roles
    user.options = ro.options  
    if(!hasValidLoginOption(user)){
      auditLogin(req, 'denied', 'oidc', 'login disabled for this user', user.username);
      return res.status(401).json({ error: i18n.t(req, 'auth.loginDisabled') });
    }
    // blocked by an admin : refused ; else recorded for its page in Settings > Users (the
    // subject : the provider's stable id of the user)
    if (!(await admitUser(req, res, user, { id: payload.sub, email: payload.email }))) return;
    // Audited like every other way in. These two paths recorded NOTHING - and /auth is
    // deliberately skipped by the blanket middleware, so an SSO login left no trace at all,
    // successful or refused. The audit trail is the control that would surface a problem here.
    auditLogin(req, 'success', 'oidc', null, user.username);
    // a recent sign-in (for an api token) only when the provider asked for the credentials again
    res.json(await userToJwt(user, undefined, { authTime: payload.reauth ? undefined : null }))

  } catch(err){
    logger.error(helpers.getError(err))
    return res.status(401).json(RestResult.error(i18n.t(req, 'auth.oidcFailed'), helpers.getError(err)));
  }
};

export default {
  basic,
  basic_ldap,
  logout,
  errorHandler,
  settings,
  entraid,
  entraidCallback,
  entraidLogin,
  oidc,
  oidcCallback,
  oidcLogin
}