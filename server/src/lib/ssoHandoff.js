'use strict';
import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth.config.js';

// Short : it only has to survive the redirect from the provider back to the login page.
export const SSO_HANDOFF_EXPIRES_IN = '5m';

// Registered claims of the PROVIDER's token that describe that token, not ours : its
// lifetime and its issuer. Our handoff token sets its own - and jsonwebtoken refuses to
// sign a payload that already carries `exp` or `iss` next to the expiresIn / issuer
// options ("Bad options.expiresIn option the payload already has an exp property"),
// which is what broke every Azure AD login (#542) : azuread hands over its access token,
// and its decoded claims hold both. An `iat` or `nbf` from the provider would also shift
// the handoff's own validity window, so they go too.
const PROVIDER_TOKEN_CLAIMS = ['exp', 'iat', 'nbf', 'iss'];

/**
 * The HANDOFF token of an SSO login : the claims passport just verified, re-signed with
 * OUR secret, so the /login endpoint can tell them apart from anything a caller made up.
 * `sso` pins which endpoint may consume it ; there is deliberately no `access` claim, so
 * auth_jwt.js will not take it as an access token.
 *
 * @param {string|object} payload  azuread : the provider's token (its claims are taken,
 *                                 the token itself is not forwarded) ; oidc : a profile
 * @param {string} type            the login method, `azuread` or `oidc`
 */
export function signHandoff(payload, type) {
  let claims = payload;
  if (typeof claims === 'string') claims = jwt.decode(claims) || {};
  if (!claims || typeof claims !== 'object') claims = {};
  const own = { ...claims };
  for (const k of PROVIDER_TOKEN_CLAIMS) delete own[k];
  return jwt.sign(
    { ...own, sso: type },
    authConfig.secret,
    { expiresIn: SSO_HANDOFF_EXPIRES_IN, issuer: authConfig.jwtIssuer },
  );
}

export default { signHandoff, SSO_HANDOFF_EXPIRES_IN };
