import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');

const OLD_DEFAULT_SECRET = 'j6fz%Q9S2YJC?x|u';

// Helper: writes a temp ESM script, runs it in a child process with controlled env,
// returns stdout. auth.config.js evaluates at module-load time so each scenario
// needs a fresh process.
function loadAuthConfig(env = {}) {
  const tmpFile = path.join(serverDir, '_test_loader.mjs');
  writeFileSync(tmpFile, `import authConfig from './config/auth.config.js';
const output = JSON.stringify({
  secret: authConfig.secret,
  secretIsGenerated: authConfig.secretIsGenerated,
  jwtExpiration: authConfig.jwtExpiration,
  jwtIssuer: authConfig.jwtIssuer,
});
process.stdout.write(output);
`);
  const cleanEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
  Object.assign(cleanEnv, env);

  try {
    const result = execSync(`node ${tmpFile}`, {
      cwd: serverDir,
      env: cleanEnv,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

describe('auth.config.js — JWT secret generation', () => {

  describe('when ACCESS_TOKEN_SECRET env var is set', () => {
    it('uses the provided secret', () => {
      const config = loadAuthConfig({ ACCESS_TOKEN_SECRET: 'my-custom-secret-123' });
      expect(config.secret).toBe('my-custom-secret-123');
    });

    it('marks secretIsGenerated as false', () => {
      const config = loadAuthConfig({ ACCESS_TOKEN_SECRET: 'my-custom-secret-123' });
      expect(config.secretIsGenerated).toBe(false);
    });

    it('preserves other config defaults', () => {
      const config = loadAuthConfig({ ACCESS_TOKEN_SECRET: 'test' });
      expect(config.jwtExpiration).toBe('30m');
      expect(config.jwtIssuer).toBe('ansibleforms');
    });
  });

  describe('when ACCESS_TOKEN_SECRET env var is NOT set', () => {
    it('generates a random secret (not the old default)', () => {
      const config = loadAuthConfig({});
      expect(config.secret).not.toBe(OLD_DEFAULT_SECRET);
      expect(config.secret.length).toBeGreaterThan(0);
    });

    it('marks secretIsGenerated as true', () => {
      const config = loadAuthConfig({});
      expect(config.secretIsGenerated).toBe(true);
    });

    it('generates a 128-char hex string (64 random bytes)', () => {
      const config = loadAuthConfig({});
      expect(config.secret).toMatch(/^[0-9a-f]{128}$/);
    });

    it('generates a different secret on each process start', () => {
      const config1 = loadAuthConfig({});
      const config2 = loadAuthConfig({});
      expect(config1.secret).not.toBe(config2.secret);
    });

    it('never produces the old hard-coded default across many runs', () => {
      for (let i = 0; i < 5; i++) {
        const config = loadAuthConfig({});
        expect(config.secret).not.toBe(OLD_DEFAULT_SECRET);
      }
    });
  });

  describe('when ACCESS_TOKEN_SECRET is empty string', () => {
    it('treats empty string as falsy and generates a random secret', () => {
      const config = loadAuthConfig({ ACCESS_TOKEN_SECRET: '' });
      expect(config.secretIsGenerated).toBe(true);
      expect(config.secret).toMatch(/^[0-9a-f]{128}$/);
    });
  });

  describe('console warning on auto-generation', () => {
    it('prints a security warning when secret is generated', () => {
      const tmpFile = path.join(serverDir, '_test_warn.mjs');
      writeFileSync(tmpFile, `import './config/auth.config.js';\n`);
      const cleanEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
      try {
        const result = execSync(`node ${tmpFile} 2>&1`, {
          cwd: serverDir,
          env: cleanEnv,
          encoding: 'utf-8',
          timeout: 10000,
        });
        expect(result).toContain('[SECURITY WARNING]');
        expect(result).toContain('ACCESS_TOKEN_SECRET');
      } finally {
        try { unlinkSync(tmpFile); } catch {}
      }
    });

    it('does NOT print a warning when secret is provided via env', () => {
      const tmpFile = path.join(serverDir, '_test_nowarn.mjs');
      writeFileSync(tmpFile, `import './config/auth.config.js';\n`);
      const env = { PATH: process.env.PATH, HOME: process.env.HOME, ACCESS_TOKEN_SECRET: 'provided' };
      try {
        const result = execSync(`node ${tmpFile} 2>&1`, {
          cwd: serverDir,
          env: env,
          encoding: 'utf-8',
          timeout: 10000,
        });
        expect(result).not.toContain('[SECURITY WARNING]');
      } finally {
        try { unlinkSync(tmpFile); } catch {}
      }
    });
  });
});
