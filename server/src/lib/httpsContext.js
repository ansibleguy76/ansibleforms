'use strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

// Live TLS certificate reload.
//
// https.config reads the key and certificate FILES at import and hands the contents to
// https.createServer, so a renewed certificate needed a restart. Node has a designed API for
// exactly this - server.setSecureContext() replaces the context for new connections - so the
// settings page can point HTTPS_KEY / HTTPS_CERT at new files, or the same files after a
// renewal, without dropping the process.
//
// Existing connections keep the old context, which is how TLS works: only new handshakes see
// the new certificate.
const __dirname_h = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KEY = path.resolve(__dirname_h, '../../persistent/certificates/key.pem');
const DEFAULT_CERT = path.resolve(__dirname_h, '../../persistent/certificates/cert.pem');

let server = null;

// index.js calls this once the https server exists. In http mode nothing registers, and
// applySecureContext then reports that it could not apply - which is correct: there is no
// TLS context to replace.
export function registerHttpsServer(httpsServer) {
  server = httpsServer && typeof httpsServer.setSecureContext === 'function' ? httpsServer : null;
  return !!server;
}

export function applySecureContext() {
  if (!server) return false;
  const keyPath = process.env.HTTPS_KEY || DEFAULT_KEY;
  const certPath = process.env.HTTPS_CERT || DEFAULT_CERT;
  let key, cert;
  try {
    key = fs.readFileSync(keyPath);
    cert = fs.readFileSync(certPath);
  } catch (e) {
    // the previous context stays in place : a missing file must not take TLS down
    logger.warning(`Could not read the new key/certificate, keeping the current one : ${e.message}`);
    return false;
  }
  try {
    server.setSecureContext({ key, cert });
    logger.notice(`TLS certificate reloaded from ${certPath}`);
    return true;
  } catch (e) {
    logger.warning(`Could not apply the new certificate, keeping the current one : ${e.message}`);
    return false;
  }
}

export default { registerHttpsServer, applySecureContext };
