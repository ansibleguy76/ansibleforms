'use strict';
import { exec as execCb } from 'child_process';
import logger from '../lib/logger.js';
import fs from 'fs';
import { inspect, promisify } from 'node:util';
import os from 'os';
import Errors from '../lib/errors.js';
import path from 'path';

const KnownHosts = {};
const exec = promisify(execCb);

function escapeRegExp(string) {
  return string.replace(/[.*?^${}()\/|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function hostsFile() {
  return path.join(os.homedir(), '.ssh', 'known_hosts');
}
KnownHosts.findAll = async function () {
  const file = hostsFile();
  try {
    if (!fs.existsSync(file)) return [];
    const data = await fs.promises.readFile(file, 'utf8');
    return data.split(/\r?\n/).filter(Boolean);
  } catch (e) {
    logger.error(inspect(e));
    throw new Errors.InternalServerError('Failed to read known_hosts');
  }
};
KnownHosts.remove = async function (host) {
  if (!host) throw new Errors.BadRequestError('No host given');
  logger.notice(`Removing host ${host}`);
  const file = hostsFile();
  if (!fs.existsSync(file)) return 'known_hosts file missing';
  try {
    const content = await fs.promises.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const filtered = lines.filter(l => l.split(/\s+/)[0] !== host);
    if (filtered.length === lines.length) {
      return `Host ${host} not found; no change`;
    }
    await fs.promises.writeFile(file, filtered.join('\n') + '\n', 'utf8');
    return `Host ${host} removed`;
  } catch (e) {
    logger.error(inspect(e));
    throw new Errors.InternalServerError('Failed to remove host');
  }
};
// add ssh known hosts
KnownHosts.add = async function (host) {
  if (!host) throw new Errors.BadRequestError('No host given');
  logger.notice(`Adding keys for host ${host}`);
  try {
    const { stdout, stderr } = await exec(`ssh-keyscan -- ${host}`);
    if (stderr) logger.debug(stderr);
    if (!stdout) throw new Errors.InternalServerError('No keyscan output');
    await fs.promises.mkdir(path.dirname(hostsFile()), { recursive: true });
    await fs.promises.appendFile(hostsFile(), stdout.endsWith('\n') ? stdout : stdout + '\n', 'utf8');
    return `Keys added for ${host}`;
  } catch (e) {
    if (e instanceof Errors.ApiError) throw e;
    logger.error(inspect(e));
    throw new Errors.InternalServerError('Failed to add host keys');
  }
};

export default KnownHosts;
