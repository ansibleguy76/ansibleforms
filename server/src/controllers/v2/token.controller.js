'use strict';
import RestResult from '../../models/restResult.model.v2.js';
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import authConfig from '../../../config/auth.config.js';
import logger from "../../lib/logger.js";
import Token from "../../models/token.model.js";
import User from "../../models/user.model.js";
import i18n from '../../lib/i18n.js';
import { isRevoked } from '../../lib/tokenRevocation.js';
import { storedGroups, tokenUser, forgetGroups } from '../../lib/userGroups.js';

// A refresh with the token another refresh has just replaced : normal when a page or several tabs
// refresh at once. 409, which the client answers by reading the tokens the other refresh stored.
function alreadyRefreshed(req, res, username, username_type) {
    logger.info(`Refresh token already used for ${username} (${username_type}), refreshed by a concurrent request`);
    return res.status(409).json({ ...RestResult.error(i18n.t(req, 'errors.refreshTokenReplaced')), code: 'refresh_token_replaced' });
}

const refresh = async function(req, res) {
    try {
        // get the refresh token
        const refreshtoken = req.body.refreshtoken;
        logger.info("requesting refresh token");
        
        if(!refreshtoken){
            logger.error("no refresh token is provided");
            return res.status(400).json(RestResult.error(i18n.t(req, 'errors.provideRefreshToken')));
        }
        
        // VERIFY, not decode. The signature was never checked, so the stored row was the
        // only authority - which meant rotating ACCESS_TOKEN_SECRET invalidated nothing,
        // contradicting what the settings page and the Status page both tell the operator.
        // A stolen refresh token kept minting valid access tokens under the NEW secret.
        // Expiry is enforced by verify() too, so the manual exp check below is now a
        // belt-and-braces path for a token that verify accepted.
        let jwtPayload;
        try {
            jwtPayload = jwt.verify(refreshtoken, authConfig.secret, { issuer: authConfig.jwtIssuer });
        } catch (e) {
            logger.error(`Refresh token rejected : ${e.message}`);
            return res.status(401).json(RestResult.error(i18n.t(req, 'errors.invalidRefreshToken')));
        }

        if(!jwtPayload || !jwtPayload.user || !jwtPayload.refresh){
            logger.error("Invalid refresh token");
            return res.status(401).json(RestResult.error(i18n.t(req, 'errors.invalidRefreshToken')));
        }
        
        const username = jwtPayload.user.username;
        const username_type = jwtPayload.user.type;

        // its session logged out, or its user changed the password since : no new tokens
        if (await isRevoked(jwtPayload)) {
            logger.warning(`Refresh refused for ${username} : the session was ended`);
            await Token.delete(username, username_type, refreshtoken).catch(() => {});
            return res.status(401).json(RestResult.error(i18n.t(req, 'errors.invalidRefreshToken')));
        }
        
        const state = await Token.check(username, username_type, refreshtoken);
        if (state === 'replaced') return alreadyRefreshed(req, res, username, username_type);
        if (state !== 'valid') {
            // a reuse after the grace, or a token logged out : a fault of the client, not of the server
            logger.warning(`Refresh refused for ${username} (${username_type}) : the refresh token is unknown, or was already used more than ${Token.REPLACED_GRACE_SECONDS}s ago`);
            return res.status(401).json(RestResult.error(i18n.t(req, 'errors.refreshTokenUnknown')));
        }
        
        if(new Date(jwtPayload.exp*1000) <= new Date()){
            logger.error("Refresh token is expired");
            await Token.delete(username, username_type, refreshtoken);
            logger.info("Removed token for " + username);
            return res.status(401).json(RestResult.error(i18n.t(req, 'errors.refreshTokenExpired')));
        }
        
        // Re-resolve the roles and options instead of copying the ones frozen at login.
        // They used to be re-signed verbatim for ever, so removing a user from a group or
        // stripping a role in config.yaml never took effect - they kept minting admin
        // access tokens one refresh at a time. Now a change lands within the access
        // token's lifetime. getRolesAndOptions degrades to safe defaults if the config
        // cannot be read, so a broken config cannot silently escalate anyone.
        //
        // The groups are not in the token any more (#1036 : they made it too large for a
        // request header) : they are read from where the sign-in stored them, a local user's
        // groups as an admin set them now, a directory user's at its last sign-in
        // (lib/userGroups.js). A refresh token issued before carries its groups : they serve
        // when nothing is stored, and the new tokens leave them out.
        const body = tokenUser(jwtPayload.user);
        try {
            const stored = await storedGroups(body);
            const groups = stored ?? (Array.isArray(jwtPayload.user.groups) ? jwtPayload.user.groups : []);
            const ro = await User.getRolesAndOptions(groups, body);
            body.roles = ro.roles;
            body.options = ro.options;
            // the requests of the new access token read them again
            forgetGroups(body.type, body.username);
        } catch (e) {
            logger.error(`Could not re-resolve roles on refresh for ${username} : ${e.message}`);
            return res.status(401).json(RestResult.error(i18n.t(req, 'errors.refreshTokenUnknown')));
        }

        // the same session : a logout still ends what this refresh hands out
        const sid = jwtPayload.sid;
        const token = jwt.sign({ user: body, access:true, sid }, authConfig.secret, { expiresIn: authConfig.jwtExpiration, issuer: authConfig.jwtIssuer });
        // jwtid : a refresh in the same second as the sign-in, or as the refresh before, signed
        // the very same token again, so rotating it replaced the token it had just stored
        const newRefreshtoken = jwt.sign({ user: body, refresh:true, sid }, authConfig.secret, { expiresIn: authConfig.jwtRefreshExpiration, issuer: authConfig.jwtIssuer, jwtid: crypto.randomUUID() });

        // Single use : the old row stayed valid, so a stolen refresh token kept working
        // alongside the new one indefinitely. It is marked replaced rather than deleted, so a
        // request that refreshed with it at the same time gets a 409 for a few seconds instead
        // of a 401 that signs the user out (#1062) ; false when such a request rotated it first.
        if (!(await Token.replace(username, username_type, refreshtoken, newRefreshtoken))) {
            return alreadyRefreshed(req, res, username, username_type);
        }
        logger.info("Token is renewed and stored");
        
        res.json(RestResult.single({ token, refreshtoken: newRefreshtoken }));
        
    } catch(err) {
        logger.error(`Error : ${err.toString()}`);
        res.status(401).json(RestResult.error(i18n.t(req, 'errors.refreshTokenUnknown')));
    }
};

export default {
  refresh
}
