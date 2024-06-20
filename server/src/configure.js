// load the .env.development file ; it loads a bunch of environment variables
// we are not doing this for production, where the variables are coming from the actual environment
if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DOTENV==1 || process.env.FORCE_DOTENV=="1" ){
  console.log(`Importing .env file : ${__dirname}/../.env.${process.env.NODE_ENV}` )
  require('dotenv').config({ path: `${__dirname}/../.env.${process.env.NODE_ENV}` })
}
// express is the base http server for nodejs
const express = require('express');
const session = require('cookie-session');

// cors is a middleware to allow cross origin resource sharing
// some routes/apis we will allow coming from other ip's/sources
// for some internal apis we will not allow cors, all requests can only come
// from localhost
const cors = require('cors')
// a plugin to add the swagger interface
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
// a parser plugin to parse the body
const bodyParser = require('body-parser');
// a plugin to help with authentication and authorization
const passport = require('passport');
// a small custom middleware to check whether the user is administrator
const checkAdminMiddleware = require('./lib/common').checkAdminMiddleware

// our personal app settings
const appConfig = require('../config/app.config')
const logger = require("./lib/logger");
const schemaRoutes = require("./routes/schema.routes");
const queryRoutes = require("./routes/query.routes");
const expressionRoutes = require("./routes/expression.routes");
const versionRoutes = require("./routes/version.routes");
const installRoutes = require("./routes/install.routes");
const lockRoutes = require("./routes/lock.routes");
const helpRoutes = require("./routes/help.routes");
const profileRoutes = require("./routes/profile.routes");
const loginRoutes = require("./routes/login.routes");
const tokenRoutes = require("./routes/token.routes");
const jobRoutes = require("./routes/job.routes");
const userRoutes = require("./routes/user.routes");
const groupRoutes = require("./routes/group.routes");
const ldapRoutes = require("./routes/ldap.routes");
const azureadRoutes = require("./routes/azuread.routes");
const oidcRoutes = require("./routes/oidc.routes");
const settingsRoutes = require("./routes/settings.routes");
const credentialRoutes = require("./routes/credential.routes");
const sshRoutes = require("./routes/ssh.routes");
const awxRoutes = require("./routes/awx.routes");
const logRoutes = require("./routes/log.routes");
const repositoryRoutes = require("./routes/repository.routes");
const knownhostsRoutes = require("./routes/knownhosts.routes");
const configRoutes = require("./routes/config.routes");

// we use 4 authentications/authorization strategies
// - basic : with username and password to get jwt tokens
// - azure-ad-oauth2 : microsoft login
// - oidc : open id connect
// - jwt : to use the jwt tokens
// passport (the auth lib used) is smart, if basic authentication headers are detected
// then the basic authentication strategy kicks and the basic login procedure starts
require('./auth/auth_basic');
require('./auth/auth_jwt');
const auth_azuread = require('./auth/auth_azuread');
const auth_oidc = require('./auth/auth_oidc');

// start the app
module.exports = app => {

  // first time run init
  // from now on, it's async => we wait for mysql to be ready
  const init = require('./init/')
  init()
      .then(()=> {
        auth_azuread.initialize()
        auth_oidc.initialize()
      })
      .catch(
          r => logger.error(r)
      );

  // passport
  app.use(session({
    secret: 'AnsibleForms',
    resave: false,
    saveUninitialized: true
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

  // mysql2 has a bug that can throw an uncaught exception if the mysql server crashes (not enough mem for example)
  // also git commands can chain child processes and cause issues
  process.on('uncaughtException', function(err) {
    // handle the error safely
    console.error("An uncaught exception happened, ignore... ",err)
  })

  // using json web tokens as middleware
  // the jwtauthentication strategy from passport (/auth/auth.js)
  // is used as a middleware.  Every route will check the token for validity
  const authobj = passport.authenticate('jwt', { session: false })

  // api routes for browser only (no cors)
  const swaggerOptions = {
    customSiteTitle: "Ansibleforms Swagger UI",
    customfavIcon: `${appConfig.baseUrl}favicon.svg`,
    customCssUrl: `${appConfig.baseUrl}assets/css/swagger.css`,
    docExpansion:"none"
  }
  // change basePath dynamically
  swaggerDocument.basePath = `${appConfig.baseUrl}api/v1`
  app.use(`${appConfig.baseUrl}api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument,swaggerOptions));
  app.use(`${appConfig.baseUrl}api/v1/schema`, schemaRoutes)

  // api routes for querying
  app.use(`${appConfig.baseUrl}api/v1/query`,cors(), authobj, queryRoutes)
  app.use(`${appConfig.baseUrl}api/v1/expression`,cors(), authobj, expressionRoutes)

  // api route for version
  app.use(`${appConfig.baseUrl}api/v1/version`,cors(), versionRoutes)
  app.use(`${appConfig.baseUrl}api/v1/install`,cors(), installRoutes)

  app.use(`${appConfig.baseUrl}api/v1/lock`,cors(),authobj, lockRoutes)
  app.use(`${appConfig.baseUrl}api/v1/help`,cors(),authobj, helpRoutes)

  // api route for profile
  app.use(`${appConfig.baseUrl}api/v1/profile`,cors(), authobj, profileRoutes)

  // api routes for authorization
  app.use(`${appConfig.baseUrl}api/v1/auth`,cors(), loginRoutes)
  app.use(`${appConfig.baseUrl}api/v1/token`,cors(), tokenRoutes)

  // api routes for automation actions

  // app.use(`${appConfig.baseUrl}api/v1/multistep`,cors(), authobj, multistepRoutes)

  // api routes for admin management
  app.use(`${appConfig.baseUrl}api/v1/job`,cors(), authobj, jobRoutes)
  app.use(`${appConfig.baseUrl}api/v1/user`,cors(), authobj, checkAdminMiddleware, userRoutes)
  app.use(`${appConfig.baseUrl}api/v1/group`,cors(), authobj, checkAdminMiddleware, groupRoutes)
  app.use(`${appConfig.baseUrl}api/v1/ldap`,cors(), authobj, checkAdminMiddleware, ldapRoutes)
  app.use(`${appConfig.baseUrl}api/v1/azuread`,cors(), authobj, checkAdminMiddleware, azureadRoutes)
  app.use(`${appConfig.baseUrl}api/v1/oidc`,cors(), authobj, checkAdminMiddleware, oidcRoutes)
  app.use(`${appConfig.baseUrl}api/v1/settings`,cors(), authobj, checkAdminMiddleware, settingsRoutes)
  app.use(`${appConfig.baseUrl}api/v1/credential`,cors(), authobj, checkAdminMiddleware, credentialRoutes)
  app.use(`${appConfig.baseUrl}api/v1/sshkey`,cors(), authobj, checkAdminMiddleware, sshRoutes)
  app.use(`${appConfig.baseUrl}api/v1/awx`,cors(), authobj, checkAdminMiddleware, awxRoutes)
  app.use(`${appConfig.baseUrl}api/v1/log`,cors(), authobj, checkAdminMiddleware, logRoutes)
  app.use(`${appConfig.baseUrl}api/v1/repository`,cors(), authobj, checkAdminMiddleware, repositoryRoutes)
  app.use(`${appConfig.baseUrl}api/v1/knownhosts`,cors(), authobj, checkAdminMiddleware, knownhostsRoutes)

  // routes for form config (extra middleware in the routes itself)
  app.use(`${appConfig.baseUrl}api/v1/config`,cors(), authobj, configRoutes)
}
