const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');

module.exports = app => {
  // load the .env.development file ; it loads a bunch of environment variables
  // we are not doing this for production, where the variables are coming from the actual environment
  if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DOTENV){
      console.log(`Importing .env file : ${__dirname}/../.env.${process.env.NODE_ENV}` )
      require('dotenv').config({ path: `${__dirname}/../.env.${process.env.NODE_ENV}` })
  }
  const logger = require('./lib/logger');
  require('./auth/auth');

  // parse requests of content-type - application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: true }))
  // parse requests of content-type - application/json
  app.use(bodyParser.json());
  // set the default file
  app.use(express.static(__dirname + '/public',{index: 'index.html'}));
  // import api routes
  const awxRoutes = require('./routes/awx.routes')
  const ansibleRoutes = require('./routes/ansible.routes')
  const queryRoutes = require('./routes/query.routes')
  const expressionRoutes = require('./routes/expression.routes')
  const userRoutes = require('./routes/user.routes')
  const groupRoutes = require('./routes/group.routes')
  const formRoutes = require('./routes/form.routes')
  const loginRoutes = require('./routes/login.routes')
  const schemaRoutes = require('./routes/schema.routes')
  const tokenRoutes = require('./routes/token.routes')

  // using json web tokens as middleware
  const authobj = passport.authenticate('jwt', { session: false })
  const checkAdminMiddleware = (req, res, next) =>  {
        try{
          if(!req.user.user.roles.includes("admin")) {
            var err=new Error("you are not an admin")
            err.status=401
            next(err)
          } else {
            logger.silly("You are admin, access to user management")
            next()
          }
        }catch(e){
          var err=new Error("you are not an admin")
          err.status=401
          next(err)
        }

  }
  // import vue routes
  app.use('/api/v1/auth', loginRoutes)
  app.use('/api/v1/schema', schemaRoutes)
  app.use('/api/v1/token', tokenRoutes)
  app.use('/api/v1/awx', authobj, awxRoutes)
  app.use('/api/v1/ansible', authobj, ansibleRoutes)
  app.use('/api/v1/query', authobj, queryRoutes)
  app.use('/api/v1/expression', authobj, expressionRoutes)
  app.use('/api/v1/user', authobj, checkAdminMiddleware, userRoutes)
  app.use('/api/v1/group', authobj, checkAdminMiddleware, groupRoutes)
  app.use('/api/v1/form', authobj, formRoutes)

}
/*
  create express app => in production !!
  https://dennisreimann.de/articles/vue-cli-serve-express.html
  the app is dev is started using package.json
  npm start => triggers nodemon --exec 'vue-cli-service serve'
  nodemon will restart the server upon changes
  vue-cli-service will run a dev express server (hence no listener in this file)
  the vue.config.js will preload this configure.js file and spin up the backend server with all the awxRoutes

  but in production.  we build the vue application frontend
  using npm run build => which will compile the vue app
  this will create a dist folder
  and in production we start node ./
  this starts index.js which starts the real express server and then points to the dist folder instead.

  in dev you can also start it like this
  NODE_ENV=development node ./ => it will then load the dotenv .env.development filename
  in production however, no env file is loaded an you must provide all environment variables upon start


*/
