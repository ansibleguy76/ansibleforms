/******************************************************************/
/*                                                                */
/*  The client an SSO provider signs in with : Microsoft Entra ID */
/*  (models/entraId.model.js) and Open ID (models/oidc.model.js)  */
/*  read it the same way. Its own client secret (from before      */
/*  credentials held it) decrypted, then the credential it names  */
/*  in Connections > Credentials over it : its user the client    */
/*  id, its password the client secret, its redirect URL, and its */
/*  tenant (Entra ID) or its issuer (Open ID).                    */
/*                                                                */
/******************************************************************/
import logger from "../lib/logger.js";
import crypto from "../lib/crypto.js";
import Credential from "./credential.model.v2.js";

/**
 * A provider's row with the client it signs in with : its own client secret decrypted (an
 * undecryptable one emptied), and when it names a credential, that credential's client id,
 * secret, redirect URL (credential_redirect_uri) and tenant or issuer over its own. A credential
 * that cannot be read is logged, and leaves the client empty : the sign-in then says why.
 *
 * Args:
 *   record (object): the oauth2_providers row (client_id, client_secret, credential, and
 *     tenant_id or issuer).
 *   label (string): the provider, for the log ('azuread', 'OIDC').
 *
 * Returns:
 *   Promise<object>: the row, its client_id, client_secret, credential_redirect_uri, tenant_id and
 *     issuer set.
 */
export async function resolveSsoClient(record, label) {
  try {
    record.client_secret = record.client_secret ? crypto.decrypt(record.client_secret) : "";
  } catch {
    logger.error(`Couldn't decrypt ${label} client_secret, did the secretkey change?`);
    record.client_secret = "";
  }
  // a credential of Connections > Credentials : its user the client id, its password the secret
  if (record.credential) {
    const cred = await Credential.resolveByName(record.credential).catch((e) => {
      logger.error(`Couldn't read the credential '${record.credential}' of the ${label} provider: ${e.message || e}`);
      return null;
    });
    record.client_id = cred?.user || "";
    record.credential_redirect_uri = cred?.redirect_uri || "";
    record.client_secret = cred?.password || "";
    // an Entra ID credential holds the tenant too, an Open ID one the issuer
    record.tenant_id = cred?.tenant_id || record.tenant_id;
    record.issuer = cred?.issuer || record.issuer;
  }
  return record;
}

export default { resolveSsoClient };
