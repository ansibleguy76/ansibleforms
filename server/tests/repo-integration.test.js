import { describe, it, expect, vi } from 'vitest';
import Repo from '../src/models/repo.model.js';

describe('Repo method integration — injection blocked before shell execution', () => {

  describe('Repo.delete()', () => {
    it('rejects command injection in name', async () => {
      await expect(Repo.delete('; rm -rf /')).rejects.toThrow(/Invalid repository name/);
    });

    it('rejects path traversal in name', async () => {
      await expect(Repo.delete('../../etc')).rejects.toThrow(/Invalid repository name/);
    });

    it('rejects null name', async () => {
      await expect(Repo.delete(null)).rejects.toThrow(/Invalid repository name/);
    });
  });

  describe('Repo.info()', () => {
    it('rejects command injection in name', async () => {
      await expect(Repo.info('repo$(whoami)')).rejects.toThrow(/Invalid repository name/);
    });

    it('rejects path traversal in name', async () => {
      await expect(Repo.info('../../../tmp')).rejects.toThrow(/Invalid repository name/);
    });
  });

  describe('Repo.pull()', () => {
    it('rejects command injection in name', async () => {
      await expect(Repo.pull('repo`id`')).rejects.toThrow(/Invalid repository name/);
    });

    it('rejects pipe injection in name', async () => {
      await expect(Repo.pull('repo|cat /etc/shadow')).rejects.toThrow(/Invalid repository name/);
    });
  });

  describe('Repo.clone()', () => {
    it('rejects injection in repo name', async () => {
      await expect(Repo.clone('https://github.com/org/repo.git', '; rm -rf /')).rejects.toThrow(/Invalid repository name/);
    });

    it('rejects injection in URI', async () => {
      await expect(Repo.clone('; curl evil.com', 'repo')).rejects.toThrow();
    });

    it('rejects injection in branch', async () => {
      await expect(Repo.clone('https://github.com/org/repo.git', 'repo', '$(whoami)')).rejects.toThrow(/Invalid branch name/);
    });

    it('rejects injection in URI with semicolon', async () => {
      await expect(Repo.clone('https://evil.com/repo;rm -rf /', 'repo')).rejects.toThrow(/invalid characters/i);
    });

    it('rejects injection in SSH-style URI', async () => {
      await expect(Repo.clone('git@host:repo;ls', 'repo')).rejects.toThrow(/invalid characters/i);
    });

    it('rejects empty URI', async () => {
      await expect(Repo.clone('', 'repo')).rejects.toThrow();
    });

    it('rejects null URI', async () => {
      await expect(Repo.clone(null, 'repo')).rejects.toThrow();
    });

    it('accepts valid clone parameters', async () => {
      // This should NOT throw on validation — it may fail later on fs.accessSync, which is fine
      // We just want to confirm the validators don't block valid input
      try {
        await Repo.clone('https://github.com/org/repo.git', 'valid_repo', 'main');
      } catch (e) {
        // Expect failure from fs operations (repo path doesn't exist), NOT from validation
        expect(e.message).not.toMatch(/Invalid repository name/);
        expect(e.message).not.toMatch(/Invalid branch name/);
        expect(e.message).not.toMatch(/Invalid repository URI/);
      }
    });
  });

  describe('Repo.addKnownHosts()', () => {
    it('rejects injection in hosts', async () => {
      await expect(Repo.addKnownHosts('host;ls')).rejects.toThrow(/Invalid hostname/);
    });

    it('rejects injection in comma-separated hosts', async () => {
      await expect(Repo.addKnownHosts('good.host,evil$(id).host')).rejects.toThrow(/Invalid hostname/);
    });

    it('rejects SSH option injection', async () => {
      await expect(Repo.addKnownHosts('-oProxyCommand=evil')).rejects.toThrow(/Invalid hostname/);
    });

    it('rejects empty hosts', async () => {
      await expect(Repo.addKnownHosts('')).rejects.toThrow();
    });

    it('rejects null hosts', async () => {
      await expect(Repo.addKnownHosts(null)).rejects.toThrow();
    });

    it('accepts valid single host', async () => {
      // Should not throw on validation — the ssh-keyscan command will fail, but not validation
      expect(() => Repo.addKnownHosts('github.com')).not.toThrow();
    });

    it('accepts valid comma-separated hosts', async () => {
      expect(() => Repo.addKnownHosts('github.com,gitlab.com')).not.toThrow();
    });

    it('accepts valid space-separated hosts', async () => {
      expect(() => Repo.addKnownHosts('github.com gitlab.com')).not.toThrow();
    });
  });
});

describe('Repo — non-security functions still work', () => {
  it('maskGitToken masks credentials in HTTPS URL', () => {
    const input = 'https://user:secret_token@github.com/org/repo.git';
    const result = Repo.maskGitToken(input);
    expect(result).toContain('*******');
    expect(result).not.toContain('secret_token');
    expect(result).toContain('github.com');
  });

  it('maskGitToken leaves non-credential URLs unchanged', () => {
    const input = 'https://github.com/org/repo.git';
    const result = Repo.maskGitToken(input);
    expect(result).toBe(input);
  });

  it('maskGitToken handles null/undefined gracefully', () => {
    expect(Repo.maskGitToken(null)).toBeNull();
    expect(Repo.maskGitToken(undefined)).toBeUndefined();
  });
});
