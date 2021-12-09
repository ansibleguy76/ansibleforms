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
// our personal app settings
const appConfig = require('../config/app.config')
// a small custom middleware to check whether the user is administrator
const checkAdminMiddleware = require('./lib/common').checkAdminMiddleware

// start the app
module.exports = app => {
  // load the .env.development file ; it loads a bunch of environment variables
  // we are not doing this for production, where the variables are coming from the actual environment
  if (appConfig.nodeEnvironment !== 'production' || appConfig.forceDotEnv ){
      console.log(`Importing .env file : ${__dirname}/../.env.${appConfig.nodeEnvironment}` )
      require('dotenv').config({ path: `${__dirname}/../.env.${appConfig.nodeEnvironment}` })
  }
  // we use 2 authentications/authorization strategies
  // - basic : to get jwt tokens
  // - jwt : to use the jwt tokens
  require('./auth/auth');

  // parse requests of content-type - application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: true }))
  // parse requests of content-type - application/json
  app.use(bodyParser.json());

  // import api routes
  const awxRoutes = require('./routes/awx.routes')
  const ansibleRoutes = require('./routes/ansible.routes')
  const queryRoutes = require('./routes/query.routes')
  const expressionRoutes = require('./routes/expression.routes')
  const userRoutes = require('./routes/user.routes')
  const groupRoutes = require('./routes/group.routes')
  const ldapRoutes = require('./routes/ldap.routes')
  const credentialRoutes = require('./routes/credential.routes')
  const formRoutes = require('./routes/form.routes')
  const loginRoutes = require('./routes/login.routes')
  const schemaRoutes = require('./routes/schema.routes')
  const tokenRoutes = require('./routes/token.routes')
  const configRoutes = require('./routes/config.routes')

  // using json web tokens as middleware
  const authobj = passport.authenticate('jwt', { session: false })

  // api routes for browser only (no cors)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api/v1/schema', schemaRoutes)
  app.use('/api/v1/query', authobj, queryRoutes)
  app.use('/api/v1/expression', authobj, expressionRoutes)

  // api routes for authorization
  app.use('/api/v1/auth',cors(), loginRoutes)
  app.use('/api/v1/token',cors(), tokenRoutes)

  // api routes for automation actions
  app.use('/api/v1/awx',cors(), authobj, awxRoutes) // extra middleware in the routes
  app.use('/api/v1/ansible',cors(), authobj, ansibleRoutes)

  // api routes for admin management
  app.use('/api/v1/user',cors(), authobj, checkAdminMiddleware, userRoutes)
  app.use('/api/v1/group',cors(), authobj, checkAdminMiddleware, groupRoutes)
  app.use('/api/v1/ldap',cors(), authobj, checkAdminMiddleware, ldapRoutes)
  app.use('/api/v1/credential',cors(), authobj, checkAdminMiddleware, credentialRoutes)

  // routes for form config (extra middleware in the routes itself)
  app.use('/api/v1/config',cors(), authobj, configRoutes)
}
