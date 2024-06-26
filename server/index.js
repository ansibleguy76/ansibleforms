// load our api logic based on express
const express = require('express')
const app = express()
// run configure
const configureAPI = require('./src/configure')
configureAPI(app)

// load our custom app config
const appConfig = require('./config/app.config')

// set the start directory to load our vue app (frontend/gui)
const { resolve } = require('path')
const publicPath = resolve(__dirname, './views')
const staticConf = { maxAge: '1y', etag: false }
app.use(appConfig.baseUrl,express.static(publicPath, staticConf))

// allow browser history
const history = require('connect-history-api-fallback')
app.use(`${appConfig.baseUrl}`, history())



// choose whether to start https or http server
var httpServer
const httpsConfig = require('./config/https.config');
const logger = require('./src/lib/logger');
logger.notice(`Serving static files from ${publicPath}`)
logger.notice(`Exposing app under ${appConfig.baseUrl}`)
if(httpsConfig.https){
  logger.notice("Running https !")
  var credentials = {key: httpsConfig.httpsKey, cert: httpsConfig.httpsCert};
  const https = require('https');
  httpServer = https.createServer(credentials, app);
}else{
  logger.notice("Running http !")
  const http = require('http');
  httpServer = http.createServer(app);
}

// start the webserver and listen on the port we choose
httpServer.listen(appConfig.port, () => logger.notice(`App running on port ${appConfig.port}!`))
