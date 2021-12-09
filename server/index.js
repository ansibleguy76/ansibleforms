// load our custom app config
const appConfig = require('./config/app.config')

// load our api logic based on express
const express = require('express')
const app = express()
const configureAPI = require('./src/configure')
configureAPI(app)

// set the start directory to load our vue app (frontend/gui)
const { resolve } = require('path')
const publicPath = resolve(__dirname, './views')
const staticConf = { maxAge: '1y', etag: false }
app.use(express.static(publicPath, staticConf))

// allow browser history
const history = require('connect-history-api-fallback')
app.use('/', history())

// choose whether to start https or http server
var httpServer
const httpsConfig = require('./config/https.config');
const logger = require('./src/lib/logger');
if(httpsConfig.https){
  logger.info("Running https !")
  var credentials = {key: httpsConfig.httpsKey, cert: httpsConfig.httpsCert};
  const https = require('https');
  httpServer = https.createServer(credentials, app);
}else{
  logger.info("Running http !")
  const http = require('http');
  httpServer = http.createServer(app);
}

// start the webserver and listen on the port we choose
httpServer.listen(appConfig.port, () => logger.info(`App running on port ${appConfig.port}!`))
