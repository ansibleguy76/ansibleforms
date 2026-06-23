import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');

const OLD_DEFAULT_SECRET = 'j6fz%Q9S2YJC?x|u';

// Get the actual secret the patched module generates (no env var set)
function getGeneratedSecret() {
  const tmpFile = path.join(serverDir, '_test_secret.mjs');
  writeFileSync(tmpFile, `import authConfig from './config/auth.config.js';
process.stdout.write(authConfig.secret);
`);
  const cleanEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
  try {
    return execSync(`node ${tmpFile}`, {
      cwd: serverDir,
      env: cleanEnv,
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

describe('JWT security — attack vector prevention', () => {

  describe('forged token attack (the core vulnerability)', () => {
    it('a token signed with the OLD default secret is NOT valid against the new random secret', () => {
      const newSecret = getGeneratedSecret();

      const forgedToken = jwt.sign(
        { id: 1, user: 'admin', role: 'admin' },
        OLD_DEFAULT_SECRET,
        { expiresIn: '1h', issuer: 'ansibleforms' }
      );

      expect(() => {
        jwt.verify(forgedToken, newSecret, { issuer: 'ansibleforms' });
      }).toThrow();
    });

    it('a forged token fails with "invalid signature" specifically', () => {
      const newSecret = getGeneratedSecret();

      const forgedToken = jwt.sign(
        { id: 1, user: 'admin', role: 'admin' },
        OLD_DEFAULT_SECRET,
        { expiresIn: '1h', issuer: 'ansibleforms' }
      );

      try {
        jwt.verify(forgedToken, newSecret, { issuer: 'ansibleforms' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.name).toBe('JsonWebTokenError');
        expect(err.message).toBe('invalid signature');
      }
    });
  });

  describe('legitimate token flow (user login simulation)', () => {
    it('a token signed with the current secret IS valid', () => {
      const currentSecret = getGeneratedSecret();

      const token = jwt.sign(
        { id: 1, user: 'admin', role: 'admin' },
        currentSecret,
        { expiresIn: '30m', issuer: 'ansibleforms' }
      );

      const decoded = jwt.verify(token, currentSecret, { issuer: 'ansibleforms' });
      expect(decoded.user).toBe('admin');
      expect(decoded.role).toBe('admin');
      expect(decoded.id).toBe(1);
    });

    it('a token signed with a configured secret (env var) is valid', () => {
      const configuredSecret = 'my-production-secret-2024';

      const token = jwt.sign(
        { id: 42, user: 'operator', role: 'user' },
        configuredSecret,
        { expiresIn: '30m', issuer: 'ansibleforms' }
      );

      const decoded = jwt.verify(token, configuredSecret, { issuer: 'ansibleforms' });
      expect(decoded.user).toBe('operator');
      expect(decoded.id).toBe(42);
    });
  });

  describe('token expiration still works', () => {
    it('an expired token is rejected even with the correct secret', () => {
      const secret = getGeneratedSecret();

      const token = jwt.sign(
        { id: 1, user: 'admin' },
        secret,
        { expiresIn: '0s', issuer: 'ansibleforms' }
      );

      expect(() => {
        jwt.verify(token, secret, { issuer: 'ansibleforms' });
      }).toThrow(/expired/i);
    });
  });

  describe('token issuer validation', () => {
    it('a token with wrong issuer is rejected', () => {
      const secret = getGeneratedSecret();

      const token = jwt.sign(
        { id: 1, user: 'admin' },
        secret,
        { expiresIn: '30m', issuer: 'attacker-app' }
      );

      expect(() => {
        jwt.verify(token, secret, { issuer: 'ansibleforms' });
      }).toThrow(/issuer/i);
    });
  });

  describe('cross-restart token invalidation', () => {
    it('tokens from one process are invalid in another (different random secrets)', () => {
      const secret1 = getGeneratedSecret();
      const secret2 = getGeneratedSecret();

      expect(secret1).not.toBe(secret2);

      const token = jwt.sign(
        { id: 1, user: 'admin' },
        secret1,
        { expiresIn: '30m', issuer: 'ansibleforms' }
      );

      expect(() => {
        jwt.verify(token, secret2, { issuer: 'ansibleforms' });
      }).toThrow();
    });
  });

  describe('secret strength', () => {
    it('generated secret has sufficient entropy (64 bytes = 512 bits)', () => {
      const secret = getGeneratedSecret();
      expect(secret.length).toBe(128);
      expect(secret).toMatch(/^[0-9a-f]+$/);
    });

    it('generated secret is not a simple pattern', () => {
      const secret = getGeneratedSecret();
      const uniqueChars = new Set(secret.split(''));
      expect(uniqueChars.size).toBeGreaterThan(10);
    });
  });

  describe('old default secret is completely removed', () => {
    it('the source code no longer contains the old default as a fallback', () => {
      const source = readFileSync(
        path.join(serverDir, 'config', 'auth.config.js'),
        'utf-8'
      );
      expect(source).not.toContain(OLD_DEFAULT_SECRET);
    });

    it('the secret assignment does not use a hardcoded fallback', () => {
      const source = readFileSync(
        path.join(serverDir, 'config', 'auth.config.js'),
        'utf-8'
      );
      // The secret line should NOT have an || "..." pattern
      // Other config values (jwtExpiration, etc.) may use || "..." — that's fine
      expect(source).not.toMatch(/secret\s*[:=].*\|\|\s*["'][^"']+["']/);
    });
  });
});
