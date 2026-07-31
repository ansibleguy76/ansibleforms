import express from 'express';
import ansibleforms from './src/app.js';
import appConfig from './config/app.config.js';
import { injectBaseUrl } from './src/lib/baseurl.js';
import { resolve } from 'path';
import history from 'connect-history-api-fallback';
import httpsConfig from './config/https.config.js';
import { registerHttpsServer } from './src/lib/httpsContext.js';
import authConfig from './config/auth.config.js';
import logger from './src/lib/logger.js';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// load the ansibleforms app
async function start(){
  await ansibleforms.load(app);

  if (authConfig.secretIsGenerated) {
    logger.warning('[SECURITY] JWT signing secret was auto-generated. All tokens will be invalidated on restart. Set the ACCESS_TOKEN_SECRET environment variable for persistent token signing.');
  }

  // set the start directory to load our vue app (frontend/gui)
  const publicPath = resolve(__dirname, './views');
  const staticConf = { maxAge: '1y', etag: false };

  // load the built index.html once and rewrite its base tag to the configured
  // base url, so the app can be hosted under a subpath (issue #106)
  var indexHtml = null;
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    indexHtml = injectBaseUrl(fs.readFileSync(indexPath, 'utf-8'), appConfig.baseUrl);
  } else {
    logger.warning(`No index.html found in ${publicPath}, did you build the client?`);
  }
  const serveIndex = (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    if (indexHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(indexHtml);
    } else {
      res.sendFile(indexPath);
    }
  };

  // allow browser history
  app.use(`/`, history()); // this order is important, it must be before the static files middleware

  // serve the (rewritten) index.html with no-cache
  app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('index.html'))) {
      return serveIndex(req, res);
    }
    next();
  });
  app.use("/", express.static(publicPath, staticConf));

  // Catchall for unmatched routes (after static and API)
  app.get(/(.*)/, serveIndex);

  // when a base url is set, mount the whole app under the subpath
  var rootApp = app;
  if (appConfig.baseUrl) {
    rootApp = express();
    // redirect the root and the subpath without trailing slash, for convenience
    // note : the exact path check matters, express also matches the trailing slash variant
    rootApp.get('/', (req, res) => res.redirect(`${appConfig.baseUrl}/`));
    rootApp.get(appConfig.baseUrl, (req, res, next) => {
      if (req.path !== appConfig.baseUrl) return next();
      res.redirect(`${appConfig.baseUrl}/${req.originalUrl.slice(req.path.length)}`);
    });
    rootApp.use(appConfig.baseUrl, app);
  }

  // choose whether to start https or http server
  let httpServer;
  logger.notice(`Serving static files from ${publicPath}`);
  logger.notice(`Exposing app under ${appConfig.baseUrl || '/'}`);
  if (httpsConfig.https) {
    logger.notice("Running https !");
    const credentials = { key: httpsConfig.httpsKey, cert: httpsConfig.httpsCert };
    httpServer = https.createServer(credentials, rootApp);
    // lets the settings page reload the certificate without a restart
    registerHttpsServer(httpServer);
  } else {
    logger.notice("Running http !");
    httpServer = http.createServer(rootApp);
  }

  // start the webserver and listen on the port we choose
  httpServer.listen(appConfig.port,  () => logger.notice(`App running on port ${appConfig.port}!`));

}
start()
