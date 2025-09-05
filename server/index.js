import express from 'express';
import ansibleforms from './src/app.js';
import appConfig from './config/app.config.js';
import { resolve } from 'path';
import history from 'connect-history-api-fallback';
import httpsConfig from './config/https.config.js';
import logger from './src/lib/logger.js';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// load the ansibleforms app
async function start(){
  await ansibleforms.load(app);

  // set the start directory to load our vue app (frontend/gui)
  const publicPath = resolve(__dirname, './views');
  const staticConf = { maxAge: '1y', etag: false };

  // Middleware to set no-cache for index.html
  app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
    next();
  });

  // allow browser history
  app.use(`/`, history()); // this order is important, it must be before the static files middleware  
  app.use("/", express.static(publicPath, staticConf));

  // Catchall for unmatched routes (after static and API)
  app.get(/(.*)/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  // choose whether to start https or http server
  let httpServer;
  logger.notice(`Serving static files from ${publicPath}`);
  logger.notice(`Exposing app under /`);
  if (httpsConfig.https) {
    logger.notice("Running https !");
    const credentials = { key: httpsConfig.httpsKey, cert: httpsConfig.httpsCert };
    httpServer = https.createServer(credentials, app);
  } else {
    logger.notice("Running http !");
    httpServer = http.createServer(app);
  }

  // start the webserver and listen on the port we choose
  httpServer.listen(appConfig.port,  () => logger.notice(`App running on port ${appConfig.port}!`));

}
start()
