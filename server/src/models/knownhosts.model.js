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
  if (!host || host === 'undefined' || host === 'null') {
    throw new Errors.BadRequestError('Invalid or missing host');
  }
  logger.notice(`Removing host ${host}`);
  const file = hostsFile();
  if (!fs.existsSync(file)) {
    return { host, removed: false, message: 'known_hosts file missing' };
  }
  try {
    const content = await fs.promises.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const remaining = [];
    let removedCount = 0;
    for (const line of lines) {
      const first = line.split(/\s+/)[0];
      if (first === host) {
        removedCount++;
        continue;
      }
      remaining.push(line);
    }
    if (removedCount === 0) {
      return { host, removed: false, message: 'Host not found', removedCount: 0 };
    }
    await fs.promises.writeFile(file, remaining.join('\n') + '\n', 'utf8');
    return { host, removed: true, message: 'Host removed', removedCount };
  } catch (e) {
    logger.error(inspect(e));
    throw new Errors.InternalServerError('Failed to remove host');
  }
};
// add ssh known hosts
KnownHosts.add = async function (host) {
  if (!host || host === 'undefined' || host === 'null') {
    throw new Errors.BadRequestError('Invalid or missing host');
  }
  logger.notice(`Adding keys for host ${host}`);
  try {
    const { stdout, stderr } = await exec(`ssh-keyscan -- ${host}`);
    if (stderr) logger.debug(stderr);
    if (!stdout) throw new Errors.InternalServerError('No keyscan output');
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    await fs.promises.mkdir(path.dirname(hostsFile()), { recursive: true });
    await fs.promises.appendFile(hostsFile(), stdout.endsWith('\n') ? stdout : stdout + '\n', 'utf8');
    return { host, added: true, message: 'Host keys added', keysCount: lines.length };
  } catch (e) {
    if (e instanceof Errors.ApiError) throw e;
    logger.error(inspect(e));
    throw new Errors.InternalServerError('Failed to add host keys');
  }
};

export default KnownHosts;
