import passport from 'passport';
import Settings from '../models/settings.model.js';
import OIDC from '../models/oidc.model.js';
import logger from "../lib/logger.js";
import * as openidClient from 'openid-client';
import appConfig from "../../config/app.config.js";

let authClient;

const initialize = async () => {
  logger.debug("Initializing OIDC strategy");
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  let oidcConfig;
  let oidc;
  let oidcEnabled = false;
  let settings = {};
  let url;
  try {
    oidc = await OIDC.isEnabled();
    oidcEnabled = !!oidc.enabled;
    if (!oidcEnabled) {
      logger.info("OIDC is not enabled");
    } else {
      oidcConfig = await OIDC.find();
      settings = await Settings.findUrl();
      url = settings.url?.replace(/\/$/g, '');
      if (!url) {
        logger.error("AnsibleForms Url is not set");
      }
    }
  } catch (err) {
    logger.error("Failed to getting OIDC Config or settings. ", err);
    return false;
  }
  try {
    logger.debug("Removing the strategy OIDC");
    passport.unuse('oidc');
    if (!oidcEnabled) {
      return true;
    }
  } catch (err) {
    logger.error("Failed to remove strategy. ", err);
  }
  if (!oidcEnabled || !url) {
    logger.error("Could not enable OIDC strategy, no config or url");
    return false;
  }
  try {
    logger.debug("Fetching OIDC Issuer");
    const oidcIssuer = await openidClient.Issuer.discover(oidcConfig.issuer);
    authClient = new oidcIssuer.Client({
      client_id: oidcConfig.client_id,
      client_secret: oidcConfig.secret_id,
      redirect_uris: [`${url}/api/v1/auth/oidc/callback`],
      post_logout_redirect_uris: [`${url}/`],
      response_types: ['code'],
    });

    logger.debug("Adding the strategy OIDC");
    passport.use(
      'oidc',
      new openidClient.Strategy({ client: authClient },
        async function (tokenSet, userinfo, done) {
          done(null, tokenSet.claims());
        }
      )
    );

    logger.info("OIDC strategy initialized");
    return true;

  } catch (err) {
    logger.error("Failed to initialize OIDC strategy. ", err);
    return false;
  }
};

const getLogoutUrl = () => {
  if (typeof authClient !== 'undefined' && authClient !== null) {
    return authClient.endSessionUrl();
  }
  return '';
};

export default {
  initialize,
  getLogoutUrl
};
