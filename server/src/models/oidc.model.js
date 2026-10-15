
'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import appConfig from "../../config/app.config.js";
import crypto from "../lib/crypto.js";
import Credential from "./credential.model.v2.js";
import { redirectUrl } from "../lib/ssoCallback.js";


class OIDC {
  static async isEnabled() {
    // SSO switched off (ENABLE_SSO, Settings > SSO) : no provider, whatever is configured
    if (!appConfig.enableSso) return { enable: 0, groupfilter: '', issuer: '' };
    // the issuer : its credential's, else its own (from before credentials held it)
    const res = await mysql.do("SELECT p.enable, p.groupfilter, COALESCE(NULLIF(c.issuer,''), p.issuer) AS issuer FROM AnsibleForms.`oauth2_providers` p LEFT JOIN AnsibleForms.`credentials` c ON c.name = p.credential WHERE p.provider='oidc' AND p.enable;");
    if (res.length > 0) {
      return res[0];
    } else {
      return { enable: 0, groupfilter: '', issuer: '' };
    }
  }

  // the provider signed in with : the enabled one of its type (Use for sign-in), never just the
  // first row - with several, that was any of them, and its tenant or client was not the one saved
  static async find() {
    const res = await mysql.do("SELECT client_id, client_secret, credential, enable, groupfilter, issuer, redirect_uri FROM AnsibleForms.`oauth2_providers` WHERE provider='oidc' AND enable ORDER BY id LIMIT 1;");
    if (res.length > 0) {
      let record = res[0];
      try {
        record.client_secret = record.client_secret ? crypto.decrypt(record.client_secret) : "";
      } catch (e) {
        logger.error("Couldn't decrypt OIDC client_secret, did the secretkey change?");
        record.client_secret = "";
      }
      // a credential of Connections > Credentials : its user the client id, its password the secret
      if (record.credential) {
        const exact = "^" + String(record.credential).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
        const cred = await Credential.resolveCredential(exact).catch((e) => {
          logger.error(`Couldn't read the credential '${record.credential}' of the OIDC provider : ${e.message || e}`);
          return null;
        });
        record.client_id = cred?.user || "";
        record.credential_redirect_uri = cred?.redirect_uri || "";
        record.client_secret = cred?.password || "";
        // an Open ID credential holds the issuer too
        record.issuer = cred?.issuer || record.issuer;
      }
      return {
        client_id: record.client_id || "",
        client_secret: record.client_secret || "",
        enable: record.enable || 0,
        groupfilter: record.groupfilter || "",
        issuer: record.issuer || "",
        // its credential's, else its own (from before), else the app's address and the callback path
        redirect_uri: await redirectUrl("oidc", record.credential_redirect_uri, record.redirect_uri)
      };
    } else {
      return {
        client_id: "",
        client_secret: "",
        enable: 0,
        groupfilter: "",
        issuer: "",
        redirect_uri: ""
      };
    }
  }
}

export default OIDC;
