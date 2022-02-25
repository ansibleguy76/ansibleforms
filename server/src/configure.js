// express is the base http server for nodejs
const express = require('express');
// cors is a middleware to allow cross origin resource sharing
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
// load the .env.development file ; it loads a bunch of environment variables
// we are not doing this for production, where the variables are coming from the actual environment
if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DOTENV==1 || process.env.FORCE_DOTENV=="1" ){
    console.log(`Importing .env file : ${__dirname}/../.env.${process.env.NODE_ENV}` )
    require('dotenv').config({ path: `${__dirname}/../.env.${process.env.NODE_ENV}` })
}

// our personal app settings
const appConfig = require('../config/app.config')

// start the app
module.exports = app => {

  // we use 2 authentications/authorization strategies
  // - basic : to get jwt tokens
  // - jwt : to use the jwt tokens
  require('./auth/auth');

  app.use(bodyParser.json({limit: '50mb'}));
  app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

  // import api routes
  const awxRoutes = require('./routes/awx.routes')
  const ansibleRoutes = require('./routes/ansible.routes')
  const gitRoutes = require('./routes/git.routes')
  const workflowRoutes = require('./routes/workflow.routes')  
  const queryRoutes = require('./routes/query.routes')
  const expressionRoutes = require('./routes/expression.routes')
  const userRoutes = require('./routes/user.routes')
  const groupRoutes = require('./routes/group.routes')
  const ldapRoutes = require('./routes/ldap.routes')
  const credentialRoutes = require('./routes/credential.routes')
  const loginRoutes = require('./routes/login.routes')
  const schemaRoutes = require('./routes/schema.routes')
  const tokenRoutes = require('./routes/token.routes')
  const configRoutes = require('./routes/config.routes')
  const versionRoutes = require('./routes/version.routes')
  const profileRoutes = require('./routes/profile.routes')

  // using json web tokens as middleware
  const authobj = passport.authenticate('jwt', { session: false })

  // api routes for browser only (no cors)
  const swaggerOptions = {
    customSiteTitle: "Ansibleforms Swagger UI",
    customfavIcon: "/favicon.svg",
    customCssUrl: "/assets/css/swagger.css",
    docExpansion:"none"
  }
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument,swaggerOptions));
  app.use('/api/v1/schema', schemaRoutes)

  // api routes for querying
  app.use('/api/v1/query',cors(), authobj, queryRoutes)
  app.use('/api/v1/expression',cors(), authobj, expressionRoutes)

  // api route for version
  app.use('/api/v1/version',cors(), versionRoutes)

  // api route for profile
  app.use('/api/v1/profile',cors(), authobj, profileRoutes)

  // api routes for authorization
  app.use('/api/v1/auth',cors(), loginRoutes)
  app.use('/api/v1/token',cors(), tokenRoutes)

  // api routes for automation actions
  app.use('/api/v1/awx',cors(), authobj, awxRoutes) // extra middleware in the routes
  app.use('/api/v1/ansible',cors(), authobj, ansibleRoutes)
  app.use('/api/v1/git',cors(), authobj, gitRoutes)
  app.use('/api/v1/workflow',cors(), authobj, gitRoutes)

  // api routes for admin management
  app.use('/api/v1/user',cors(), authobj, checkAdminMiddleware, userRoutes)
  app.use('/api/v1/group',cors(), authobj, checkAdminMiddleware, groupRoutes)
  app.use('/api/v1/ldap',cors(), authobj, checkAdminMiddleware, ldapRoutes)
  app.use('/api/v1/credential',cors(), authobj, checkAdminMiddleware, credentialRoutes)

  // routes for form config (extra middleware in the routes itself)
  app.use('/api/v1/config',cors(), authobj, configRoutes)
}
