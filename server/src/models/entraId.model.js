'use strict';
import mysql from "./db.model.js";
import { resolveSsoClient } from "./ssoClient.js";
import { redirectUrl } from "../lib/ssoCallback.js";

class EntraId {
  static async isEnabled() {
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
      // its client : its own secret decrypted, its credential's client over it (models/ssoClient.js)
      const record = await resolveSsoClient(res[0], "azuread");
      return {
        tenant_id: record.tenant_id || null,
        client_id: record.client_id || "",
        client_secret: record.client_secret || "",
        enable: record.enable || 0,
        groupfilter: record.groupfilter || "",
        // its credential's, else its own (from before), else the app's address and the callback path
        redirect_uri: await redirectUrl("entraid", record.credential_redirect_uri, record.redirect_uri)
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
