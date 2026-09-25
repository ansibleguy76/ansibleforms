// POST /api/v2/schema drops and recreates every table. It is the documented
// bootstrap step on a fresh database (where no account exists to authenticate as),
// so it stays open only while the database is un-provisioned and requires an
// authenticated admin from the moment it holds accounts.
import { test, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'http';
import jwt from 'jsonwebtoken';

// the route must be reachable without a database : mock the model it asks and the
// controller it would run
const isProvisioned = vi.fn();
const create = vi.fn(async () => ({ message: 'created' }));

vi.mock('../src/models/schema.model.js', () => ({
  default: { isProvisioned: (...a) => isProvisioned(...a), hasSchema: vi.fn() }
}));
vi.mock('../src/controllers/v2/schema.controller.js', () => ({
  default: {
    hasSchema: (req, res) => res.json({ ok: true }),
    create: async (req, res) => res.json(await create())
  }
}));
vi.mock('../src/lib/logger.js', () => ({
  default: { debug: vi.fn(), info: vi.fn(), notice: vi.fn(), warning: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

let server;
let baseUrl;
let secret;

beforeAll(async () => {
  process.env.ACCESS_TOKEN_SECRET = 'schema-route-test-secret';
  const express = (await import('express')).default;
  const passport = (await import('passport')).default;
  await import('../src/auth/auth_jwt.js');
  secret = (await import('../config/auth.config.js')).default.secret;
  const schemaRoutes = (await import('../src/routes/v2/schema.routes.js')).default;

  const app = express();
  app.use(passport.initialize());
  app.use('/api/v2/schema', schemaRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v2/schema`;
});

afterAll(async () => {
  if (server) await new Promise((r) => server.close(r));
});

const token = (roles) => jwt.sign({ access: true, user: { username: 'x', type: 'local', roles, options: {} } }, secret);
const post = (headers = {}) => fetch(baseUrl, { method: 'POST', headers });

test('an un-provisioned database may be bootstrapped without authentication', async () => {
  isProvisioned.mockResolvedValue(false);
  const res = await post();
  expect(res.status).toBe(200);
  expect(create).toHaveBeenCalled();
});

test('a provisioned database refuses an unauthenticated schema creation', async () => {
  create.mockClear();
  isProvisioned.mockResolvedValue(true);
  const res = await post();
  expect(res.status).toBe(401);
  const body = await res.json();
  // the refusal has to say WHY a previously open endpoint now says no
  expect(body.error).toMatch(/administrator/i);
  expect(body.details).toMatch(/already provisioned/i);
  expect(create).not.toHaveBeenCalled();
});

test('a provisioned database refuses a non-admin, and accepts an admin', async () => {
  create.mockClear();
  isProvisioned.mockResolvedValue(true);

  const bad = await post({ Authorization: `Bearer ${token(['public'])}` });
  expect(bad.status).toBe(403);
  expect(create).not.toHaveBeenCalled();

  const good = await post({ Authorization: `Bearer ${token(['admin', 'public'])}` });
  expect(good.status).toBe(200);
  expect(create).toHaveBeenCalled();
});

test('an invalid token is refused, and a failing check never opens the endpoint', async () => {
  create.mockClear();
  isProvisioned.mockResolvedValue(true);
  const res = await post({ Authorization: 'Bearer not-a-token' });
  expect(res.status).toBe(401);

  // a database we can not question is not proof of a fresh install
  isProvisioned.mockRejectedValue(new Error('connection refused'));
  const err = await post();
  expect(err.status).toBe(500);
  expect(create).not.toHaveBeenCalled();
});

test('GET stays public : the SPA polls it on every page load', async () => {
  isProvisioned.mockResolvedValue(true);
  const res = await fetch(baseUrl);
  expect(res.status).toBe(200);
});
