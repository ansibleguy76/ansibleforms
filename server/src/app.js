import './load-env.js'; // load the .env file if not in production => must be the first import
// Node.js core modules
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Third-party modules
import session from "cookie-session";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import bodyParser from "body-parser";
import passport from "passport";

// App configuration and utilities
import Middleware from "./lib/middleware.js";
import init from "./init/index.js";

// Authentication strategies
import auth_azuread from "./auth/auth_azuread.js";
import auth_oidc from "./auth/auth_oidc.js";
import "./auth/auth_basic.js";
import "./auth/auth_jwt.js";

// API route handlers
import schemaRoutes from "./routes/schema.routes.js";
import queryRoutes from "./routes/query.routes.js";
import expressionRoutes from "./routes/expression.routes.js";
import versionRoutes from "./routes/version.routes.js";
import installRoutes from "./routes/install.routes.js";
import lockRoutes from "./routes/lock.routes.js";
import helpRoutes from "./routes/help.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import loginRoutes from "./routes/login.routes.js";
import tokenRoutes from "./routes/token.routes.js";
import jobRoutes from "./routes/job.routes.js";
import jobRoutesv2 from "./routes/job.routes.v2.js";
import userRoutes from "./routes/user.routes.js";
import groupRoutes from "./routes/group.routes.js";
import ldapRoutes from "./routes/ldap.routes.js";
import oauth2Routes from "./routes/oauth2.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import credentialRoutes from "./routes/credential.routes.js";
import credentialRoutesv2 from "./routes/credential.routes.v2.js";
import sshRoutes from "./routes/ssh.routes.js";
import logRoutes from "./routes/log.routes.js";
import repositoryRoutes from "./routes/repository.routes.js";
import knownhostsRoutes from "./routes/knownhosts.routes.js";
import configRoutes from "./routes/config.routes.js";
import datasourceSchemaRoutes from "./routes/datasourceSchema.routes.js";
import datasourceRoutes from "./routes/datasource.routes.js";
import scheduleRoutes from "./routes/schedule.routes.js";
import appRoutes from "./routes/app.routes.js";
import awxRoutesv2 from "./routes/awx.routes.v2.js";
import backupRoutes from "./routes/backup.routes.js";

// __dirname and __filename setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerDocumentV1 = JSON.parse(fs.readFileSync(path.join(__dirname, "swagger_v1.json"), "utf8"));
const swaggerDocumentV2 = JSON.parse(fs.readFileSync(path.join(__dirname, "swagger_v2.json"), "utf8"));

// a small custom middleware to check whether the user has access to routes

// start the app
const load = async (app) => {
  // first time run of the app
  // from now on, it's async => we wait for mysql to be ready
  await init()
  await auth_azuread.initialize(); // we wait for the azuread to be ready
  await auth_oidc.initialize(); // we wait for the oidc to be ready

  // passport
  app.use(
    session({
      secret: "AnsibleForms",
      resave: false,
      saveUninitialized: true,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // register regenerate & save after the cookieSession middleware initialization
  app.use(function (request, response, next) {
    if (request.session && !request.session.regenerate) {
      request.session.regenerate = (cb) => {
        cb();
      };
    }
    if (request.session && !request.session.save) {
      request.session.save = (cb) => {
        cb();
      };
    }
    next();
  });

  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

  // mysql2 has a bug that can throw an uncaught exception if the mysql server crashes (not enough mem for example)
  // also git commands can chain child processes and cause issues
  process.on("uncaughtException", function (err) {
    // handle the error safely
    console.error("An uncaught exception happened, ignore... ", err);
  });

  // using json web tokens as middleware
  // the jwtauthentication strategy from passport (/auth/auth.js)
  // is used as a middleware.  Every route will check the token for validity
  const authobj = passport.authenticate("jwt", { session: false });

  // api docs for v1 and v2
  const swaggerOptions = {
    customSiteTitle: "Ansibleforms Swagger UI",
    customfavIcon: `/favicon.svg`,
    customCssUrl: `/assets/css/swagger.css`,
    docExpansion: "none",
  };
  // v1 docs
  swaggerDocumentV1.basePath = `/api/v1`;
  app.use(`/api/v1/docs`, cors(), swaggerUi.serveFiles(swaggerDocumentV1, swaggerOptions), swaggerUi.setup(swaggerDocumentV1, swaggerOptions));
  // v2 docs
  swaggerDocumentV2.basePath = `/api/v2`;
  app.use(`/api/v2/docs`, cors(), swaggerUi.serveFiles(swaggerDocumentV2, swaggerOptions), swaggerUi.setup(swaggerDocumentV2, swaggerOptions));
  app.use(`/api/v2/schema`, cors(), schemaRoutes);

  // api routes for querying
  app.use(`/api/v1/query`, cors(), authobj, queryRoutes);
  app.use(`/api/v1/expression`, cors(), authobj, expressionRoutes);

  // api route for version
  app.use(`/api/v1/version`, cors(), versionRoutes);
  app.use(`/api/v1/install`, cors(), installRoutes);

  app.use(`/api/v2/lock`, cors(), authobj, lockRoutes);
  app.use(`/api/v1/help`, cors(), authobj, helpRoutes);

  // api route for profile
  app.use(`/api/v1/profile`, cors(), authobj, profileRoutes);

  // api routes for authorization
  app.use(`/api/v1/auth`, cors(), loginRoutes);
  app.use(`/api/v2/auth`, cors(), loginRoutes);

  app.use(`/api/v1/token`, cors(), tokenRoutes);
  app.use(`/api/v2/token`, cors(), tokenRoutes);

  // api routes for the vue3 app, is private
  app.use(`/api/v2/app`, cors(), appRoutes);

  // app.use(`/api/v1/multistep`,cors(), authobj, multistepRoutes)

  // api routes for admin management
  app.use(`/api/v1/job`, cors(), authobj, jobRoutes);
  app.use(`/api/v2/job`, cors(), authobj, jobRoutesv2);
  app.use(`/api/v1/user`, cors(), authobj, Middleware.checkSettingsMiddleware, userRoutes);
  app.use(`/api/v1/group`, cors(), authobj, Middleware.checkSettingsMiddleware, groupRoutes);
  app.use(`/api/v1/ldap`, cors(), authobj, Middleware.checkSettingsMiddleware, ldapRoutes);
  app.use(`/api/v2/oauth2`, cors(), authobj, Middleware.checkSettingsMiddleware, oauth2Routes);
  app.use(`/api/v1/settings`, cors(), authobj, Middleware.checkSettingsMiddleware, settingsRoutes);
  app.use(`/api/v1/credential`, cors(), authobj, Middleware.checkSettingsMiddleware, credentialRoutes);
  app.use(`/api/v2/credential`, cors(), authobj, Middleware.checkSettingsMiddleware, credentialRoutesv2);
  app.use(`/api/v1/sshkey`, cors(), authobj, Middleware.checkSettingsMiddleware, sshRoutes);
  app.use(`/api/v2/awx`, cors(), authobj, Middleware.checkSettingsMiddleware, awxRoutesv2);
  app.use(`/api/v1/log`, cors(), authobj, Middleware.checkLogsMiddleware, logRoutes);
  app.use(`/api/v1/repository`, cors(), authobj, Middleware.checkSettingsMiddleware, repositoryRoutes);
  app.use(`/api/v2/knownhosts`, cors(), authobj, Middleware.checkSettingsMiddleware, knownhostsRoutes);
  app.use(`/api/v1/datasource/schema`, cors(), authobj, Middleware.checkSettingsMiddleware, datasourceSchemaRoutes);
  app.use(`/api/v1/datasource`, cors(), authobj, Middleware.checkSettingsMiddleware, datasourceRoutes);
  app.use(`/api/v2/schedule`, cors(), authobj, Middleware.checkSettingsMiddleware, scheduleRoutes);

  // backup/restore/list routes
  app.use(`/api/v2/backup`, cors(), authobj, backupRoutes);

  // routes for form config (extra middleware in the routes itself)
  app.use(`/api/v1/config`, cors(), authobj, configRoutes);
}


export default {
  load
}
