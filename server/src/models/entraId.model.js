'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import appConfig from "../../config/app.config.js";
import crypto from "../lib/crypto.js";
import Credential from "./credential.model.v2.js";

class EntraId {
  static async isEnabled() {
    // SSO switched off (ENABLE_SSO, Settings > SSO) : no provider, whatever is configured
    if (!appConfig.enableSso) return { enable: 0, groupfilter: '' };
    const res = await mysql.do("SELECT enable,groupfilter FROM AnsibleForms.`oauth2_providers` where provider='azuread' and enable;");
    if (res.length > 0) {
      return res[0];
    } else {
      return { enable: 0, groupfilter: '' };
    }
  }

  // the provider signed in with : the enabled one of its type (Use for sign-in), never just the
  // first row - with several, that was any of them, and its tenant or client was not the one saved
  static async find() {
    const res = await mysql.do("SELECT tenant_id,client_id, client_secret, credential, enable, groupfilter,redirect_uri FROM AnsibleForms.`oauth2_providers` WHERE provider='azuread' AND enable ORDER BY id LIMIT 1;");
    if (res.length > 0) {
      let record = res[0];
      try {
        record.client_secret = record.client_secret ? crypto.decrypt(record.client_secret) : "";
      } catch (e) {
        logger.error("Couldn't decrypt azuread client_secret, did the secretkey change?");
        record.client_secret = "";
      }
      // a credential of Connections > Credentials : its user the client id, its password the secret
      if (record.credential) {
        const exact = "^" + String(record.credential).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$";
        const cred = await Credential.resolveCredential(exact).catch((e) => {
          logger.error(`Couldn't read the credential '${record.credential}' of the azuread provider : ${e.message || e}`);
          return null;
        });
        record.client_id = cred?.user || "";
        record.client_secret = cred?.password || "";
        // an Entra ID credential holds the tenant too
        record.tenant_id = cred?.tenant_id || record.tenant_id;
      }
      return {
        tenant_id: record.tenant_id || null,
        client_id: record.client_id || "",
        client_secret: record.client_secret || "",
        enable: record.enable || 0,
        groupfilter: record.groupfilter || "",
        redirect_uri: record.redirect_uri || ""
      };
    } else {
      return {
        client_id: "",
        client_secret: "",
        enable: 0,
        groupfilter: "",
        redirect_uri: ""
      };
    }
  }
}


export default EntraId;
