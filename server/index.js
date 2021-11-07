const { resolve } = require('path')
const history = require('connect-history-api-fallback')
const express = require('express')
const https = require('https');
const http = require('http');
const app = express()
const configureAPI = require('./src/configure')
const appConfig = require('./config/app.config')
configureAPI(app)

const httpsConfig = require('./config/https.config');
const logger = require('./src/lib/logger');

// UI
const publicPath = resolve(__dirname, './views')
const staticConf = { maxAge: '1y', etag: false }

app.use(express.static(publicPath, staticConf))
app.use('/', history())
var httpServer
if(httpsConfig.https){
  logger.info("Running https !")
  var credentials = {key: httpsConfig.httpsKey, cert: httpsConfig.httpsCert};
  httpServer = https.createServer(credentials, app);
}else{
  logger.info("Running http !")
  httpServer = http.createServer(app);
}

// Go
httpServer.listen(appConfig.port, () => logger.info(`App running on port ${appConfig.port}!`))
