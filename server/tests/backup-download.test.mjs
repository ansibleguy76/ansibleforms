// GET /api/v2/backup/:folder/download : a backup folder as a .tar.gz, streamed. The same
// permission as every backup route (allowBackupOps), the folder name checked as theirs (14
// digits, nothing that can leave the backup path), and only the folder's own files in it.
//
// The real routes, middleware, controller and model run here ; vitest.config.js aliases the
// model's app.config to tests/__mocks__/app.config.js, so pointing backupPath at a temporary
// folder is all it takes to give the route a real backup to stream.
import { test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import { extract } from 'tar';

// the audit entries the route writes, recorded instead of stored
const audits = [];
vi.mock('../src/models/audit.model.js', () => ({ default: { log: (entry) => audits.push(entry) } }));
// the model's database : never reached by a download, never a real connection
vi.mock('../src/models/db.model.js', () => ({ default: { do: async () => ({}) } }));
vi.mock('../src/lib/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), notice: vi.fn(), warning: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

// db.config.js throws at import time unless these are present
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_PORT ||= '3306';
process.env.DB_USER ||= 'test';
process.env.DB_PASSWORD ||= 'test';

const FOLDER = '20261019212310';
let server;
let baseUrl;
let secret;
let tmpRoot;
let appConfig;

beforeAll(async () => {
  process.env.ACCESS_TOKEN_SECRET = 'backup-download-test-secret';
  // a managed env file of its own : never the developer's real persistent/.env
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'af-backup-download-'));
  process.env.MANAGED_ENV_PATH = path.join(tmpRoot, '.env');
  appConfig = (await import('./__mocks__/app.config.js')).default;
  const express = (await import('express')).default;
  const passport = (await import('passport')).default;
  await import('../src/auth/auth_jwt.js');
  secret = (await import('../config/auth.config.js')).default.secret;
  const backupRoutes = (await import('../src/routes/v2/backup.routes.js')).default;

  const app = express();
  app.use(passport.initialize());
  app.use('/api/v2/backup', passport.authenticate('jwt', { session: false }), backupRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v2/backup`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

// a small backup folder, as doBackup leaves one : the dump, config.yaml, meta.yaml, the
// environment file and the forms folder ; and, beside the backups, a file that is not in it
beforeEach(async () => {
  audits.length = 0;
  appConfig.backupPath = path.join(tmpRoot, 'backups');
  await fs.rm(appConfig.backupPath, { recursive: true, force: true });
  const dir = path.join(appConfig.backupPath, FOLDER);
  await fs.mkdir(path.join(dir, 'forms', 'sub'), { recursive: true });
  await fs.writeFile(path.join(dir, 'ansibleforms.sql'), '-- MySQL dump\nCREATE TABLE x();\n');
  await fs.writeFile(path.join(dir, 'config.yaml'), 'categories: []\n');
  await fs.writeFile(path.join(dir, 'meta.yaml'), 'description: before the upgrade\n');
  await fs.writeFile(path.join(dir, 'managed.env'), 'LOG_LEVEL=info\n', { mode: 0o600 });
  await fs.writeFile(path.join(dir, 'forms', 'sub', 'demo.yaml'), 'name: demo\n');
  await fs.writeFile(path.join(tmpRoot, 'outside.txt'), 'not part of any backup\n');
});

const token = (options) =>
  jwt.sign({ access: true, user: { username: 'x', type: 'local', roles: ['default'], options } }, secret);
// a backup operator, signed when asked (the secret is read in beforeAll)
const operator = () => ({ Authorization: `Bearer ${token({ allowBackupOps: true })}` });

test('a download without the backup permission is refused', async () => {
  const res = await fetch(`${baseUrl}/${FOLDER}/download`, {
    headers: { Authorization: `Bearer ${token({ allowBackupOps: false, showSettings: true })}` },
  });
  expect(res.status).toBe(403);
  expect(audits).toEqual([]);
});

test('a download without a login is refused', async () => {
  expect((await fetch(`${baseUrl}/${FOLDER}/download`)).status).toBe(401);
});

test('a folder that is not a backup name is refused, so nothing outside the backups can be read', async () => {
  for (const bad of ['..', '%2E%2E', '..%2Foutside.txt', '2026101921231', 'abcdefghijklmn', `${FOLDER}x`]) {
    const res = await fetch(`${baseUrl}/${bad}/download`, { headers: operator() });
    expect([400, 404], `${bad} answered ${res.status}`).toContain(res.status);
    expect(res.headers.get('content-type') || '').not.toMatch(/gzip/);
  }
  // a well formed name with no such backup
  const missing = await fetch(`${baseUrl}/20200101000000/download`, { headers: operator() });
  expect(missing.status).toBe(404);
  expect(audits).toEqual([]);
});

test('a backup streams as a valid .tar.gz holding its folder and its files', async () => {
  const res = await fetch(`${baseUrl}/${FOLDER}/download`, { headers: operator() });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('application/gzip');
  expect(res.headers.get('content-disposition')).toBe(`attachment; filename="ansibleforms-backup-${FOLDER}.tar.gz"`);
  const bytes = Buffer.from(await res.arrayBuffer());
  // gzip's magic number
  expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));

  // extracted, it is the same folder with the same files
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'af-backup-extract-'));
  try {
    const file = path.join(out, 'archive.tar.gz');
    await fs.writeFile(file, bytes);
    await extract({ file, cwd: out });
    const root = path.join(out, FOLDER);
    expect((await fs.readdir(root)).sort()).toEqual(['ansibleforms.sql', 'config.yaml', 'forms', 'managed.env', 'meta.yaml']);
    expect(await fs.readFile(path.join(root, 'ansibleforms.sql'), 'utf8')).toMatch(/CREATE TABLE x/);
    expect(await fs.readFile(path.join(root, 'forms', 'sub', 'demo.yaml'), 'utf8')).toBe('name: demo\n');
  } finally {
    await fs.rm(out, { recursive: true, force: true });
  }
  // and who took it is in the audit log
  expect(audits).toEqual([expect.objectContaining({ action: 'backup.download', targetType: 'backup', target: FOLDER })]);
});

test('a symbolic link in the folder is left out : nothing beyond its own files goes in', async () => {
  const dir = path.join(appConfig.backupPath, FOLDER);
  await fs.symlink(path.join(tmpRoot, 'outside.txt'), path.join(dir, 'forms', 'leak.txt'));
  await fs.symlink(tmpRoot, path.join(dir, 'forms', 'leakdir'));
  const res = await fetch(`${baseUrl}/${FOLDER}/download`, { headers: operator() });
  expect(res.status).toBe(200);
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'af-backup-extract-'));
  try {
    const file = path.join(out, 'archive.tar.gz');
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    const entries = [];
    await extract({ file, cwd: out, onReadEntry: (e) => entries.push(e.path) });
    expect(entries.some((p) => /leak/.test(p))).toBe(false);
    expect(entries).toContain(`${FOLDER}/forms/sub/demo.yaml`);
  } finally {
    await fs.rm(out, { recursive: true, force: true });
  }
});
