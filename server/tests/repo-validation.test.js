import { describe, it, expect } from 'vitest';
import { validateRepoName, validateBranch, validateUri, validateHostname } from '../src/models/repo.model.js';

// =============================================================================
// validateRepoName
// =============================================================================

describe('validateRepoName', () => {
  describe('accepts valid repository names', () => {
    const valid = [
      'my-repo',
      'repo_name',
      'repo.name',
      'MyRepo123',
      'a',
      'A',
      '_private',
      'repo-with-many-hyphens',
      'repo_with_underscores',
      'UPPERCASE',
      '123numeric',
    ];
    valid.forEach(name => {
      it(`accepts "${name}"`, () => {
        expect(() => validateRepoName(name)).not.toThrow();
      });
    });
  });

  describe('rejects shell injection payloads', () => {
    const injections = [
      ['; rm -rf /',               'semicolon command separator'],
      ['repo$(whoami)',             'dollar-paren command substitution'],
      ['repo`id`',                 'backtick command substitution'],
      ['repo && cat /etc/passwd',  'double-ampersand chaining'],
      ['repo;ls',                  'semicolon without space'],
      ['repo|cat /etc/shadow',     'pipe operator'],
      ['repo > /tmp/pwned',        'output redirection'],
      ['repo < /dev/null',         'input redirection'],
      ['repo\nls',                 'newline injection'],
      ['repo\rls',                 'carriage return injection'],
      ['repo name',                'space in name'],
      ['repo$(IFS)name',           'IFS variable abuse'],
      ['repo${HOME}',              'variable expansion'],
    ];
    injections.forEach(([name, desc]) => {
      it(`rejects ${desc}: "${name}"`, () => {
        expect(() => validateRepoName(name)).toThrow(/Invalid repository name/);
      });
    });
  });

  describe('rejects path traversal attempts', () => {
    const traversals = [
      ['../../etc/passwd',    'parent directory traversal'],
      ['..',                  'bare double-dot'],
      ['repo/../etc',         'embedded traversal'],
      ['a..b',                'double-dot within name'],
    ];
    traversals.forEach(([name, desc]) => {
      it(`rejects ${desc}: "${name}"`, () => {
        expect(() => validateRepoName(name)).toThrow(/Invalid repository name/);
      });
    });
  });

  describe('rejects invalid edge cases', () => {
    it('rejects empty string', () => {
      expect(() => validateRepoName('')).toThrow(/Invalid repository name/);
    });

    it('rejects null', () => {
      expect(() => validateRepoName(null)).toThrow(/Invalid repository name/);
    });

    it('rejects undefined', () => {
      expect(() => validateRepoName(undefined)).toThrow(/Invalid repository name/);
    });

    it('rejects number', () => {
      expect(() => validateRepoName(42)).toThrow(/Invalid repository name/);
    });

    it('rejects name starting with hyphen', () => {
      expect(() => validateRepoName('-repo')).toThrow(/Invalid repository name/);
    });

    it('rejects name starting with dot', () => {
      expect(() => validateRepoName('.hidden')).toThrow(/Invalid repository name/);
    });

    it('rejects name with slash (not allowed for repo names)', () => {
      expect(() => validateRepoName('org/repo')).toThrow(/Invalid repository name/);
    });
  });
});

// =============================================================================
// validateBranch
// =============================================================================

describe('validateBranch', () => {
  describe('accepts valid branch names', () => {
    const valid = [
      'main',
      'develop',
      'feature/my-feature',
      'release/v1.0.0',
      'hotfix_123',
      'feature/deep/nested/branch',
      'v2.0',
      'UPPERCASE_BRANCH',
      'a',
    ];
    valid.forEach(branch => {
      it(`accepts "${branch}"`, () => {
        expect(() => validateBranch(branch)).not.toThrow();
      });
    });
  });

  describe('rejects shell injection payloads', () => {
    const injections = [
      ['main; rm -rf /',           'semicolon command separator'],
      ['$(whoami)',                 'dollar-paren command substitution'],
      ['`id`',                     'backtick command substitution'],
      ['branch && ls',             'double-ampersand chaining'],
      ['branch|cat /etc/passwd',   'pipe operator'],
      ['branch > /tmp/pwned',      'output redirection'],
      ['branch name',              'space in name'],
    ];
    injections.forEach(([branch, desc]) => {
      it(`rejects ${desc}: "${branch}"`, () => {
        expect(() => validateBranch(branch)).toThrow(/Invalid branch name/);
      });
    });
  });

  describe('rejects directory traversal', () => {
    it('rejects branch..master (double-dot)', () => {
      expect(() => validateBranch('branch..master')).toThrow(/Invalid branch name/);
    });

    it('rejects bare ".."', () => {
      expect(() => validateBranch('..')).toThrow(/Invalid branch name/);
    });
  });

  describe('rejects invalid edge cases', () => {
    it('rejects empty string', () => {
      expect(() => validateBranch('')).toThrow(/Invalid branch name/);
    });

    it('rejects null', () => {
      expect(() => validateBranch(null)).toThrow(/Invalid branch name/);
    });

    it('rejects undefined', () => {
      expect(() => validateBranch(undefined)).toThrow(/Invalid branch name/);
    });

    it('rejects branch starting with hyphen', () => {
      expect(() => validateBranch('-branch')).toThrow(/Invalid branch name/);
    });

    it('rejects branch starting with dot', () => {
      expect(() => validateBranch('.branch')).toThrow(/Invalid branch name/);
    });

    it('rejects branch starting with slash', () => {
      expect(() => validateBranch('/branch')).toThrow(/Invalid branch name/);
    });
  });
});

// =============================================================================
// validateUri
// =============================================================================

describe('validateUri', () => {
  describe('accepts valid URIs', () => {
    const valid = [
      'https://github.com/org/repo.git',
      'http://github.com/org/repo.git',
      'git://github.com/org/repo.git',
      'ssh://git@github.com/org/repo.git',
      'git@github.com:org/repo.git',
      'deploy@gitlab.example.com:group/project.git',
      'https://user:token@github.com/org/repo.git',
      'https://x-access-token:ghp_abc123@github.com/org/repo.git',
    ];
    valid.forEach(uri => {
      it(`accepts "${uri}"`, () => {
        expect(() => validateUri(uri)).not.toThrow();
      });
    });
  });

  describe('rejects shell injection in URIs', () => {
    const injections = [
      ['https://evil.com/repo;rm -rf /',       'semicolon in path'],
      ['git://host/repo$(whoami)',              'command substitution in path'],
      ['https://host/repo`id`',                'backtick in path'],
      ['https://host/repo|cat /etc/passwd',    'pipe in path'],
      ['https://host/repo&& curl evil.com',    'ampersand in path'],
      ['https://host/repo > /tmp/pwned',       'redirection in path'],
      ['https://host/repo\nid',                'newline in URI'],
      ['https://host/repo\rid',                'carriage return in URI'],
      ['git@host:repo$(id)',                    'injection in SSH-style path'],
      ['git@host:repo;ls',                     'semicolon in SSH-style path'],
    ];
    injections.forEach(([uri, desc]) => {
      it(`rejects ${desc}: "${uri}"`, () => {
        expect(() => validateUri(uri)).toThrow();
      });
    });
  });

  describe('rejects invalid URI schemes', () => {
    const invalid = [
      ['; curl evil.com',          'no scheme, starts with semicolon'],
      ['not-a-valid-uri',          'plain text, no scheme'],
      ['ftp://host/repo',          'unsupported ftp scheme'],
      ['file:///etc/passwd',       'file scheme (local access)'],
      ['/etc/passwd',              'absolute path'],
      ['../relative/path',         'relative path'],
    ];
    invalid.forEach(([uri, desc]) => {
      it(`rejects ${desc}: "${uri}"`, () => {
        expect(() => validateUri(uri)).toThrow();
      });
    });
  });

  describe('rejects invalid edge cases', () => {
    it('rejects empty string', () => {
      expect(() => validateUri('')).toThrow();
    });

    it('rejects null', () => {
      expect(() => validateUri(null)).toThrow();
    });

    it('rejects undefined', () => {
      expect(() => validateUri(undefined)).toThrow();
    });
  });
});

// =============================================================================
// validateHostname
// =============================================================================

describe('validateHostname', () => {
  describe('accepts valid hostnames', () => {
    const valid = [
      'github.com',
      'gitlab.example.com',
      'my-host',
      'host_name',
      '192.168.1.1',
      'a',
      'internal.corp.example.com',
    ];
    valid.forEach(host => {
      it(`accepts "${host}"`, () => {
        expect(() => validateHostname(host)).not.toThrow();
      });
    });
  });

  describe('rejects shell injection payloads', () => {
    const injections = [
      ['host;ls',                       'semicolon injection'],
      ['host$(id)',                      'command substitution'],
      ['host`whoami`',                  'backtick injection'],
      ['host && cat /etc/passwd',       'ampersand chaining'],
      ['host|cat /etc/shadow',          'pipe injection'],
      ['host > /tmp/pwned',             'redirection'],
      ['-oProxyCommand=evil',           'SSH option injection'],
      ['host name with spaces',         'spaces'],
      ['host\nid',                      'newline injection'],
    ];
    injections.forEach(([host, desc]) => {
      it(`rejects ${desc}: "${host}"`, () => {
        expect(() => validateHostname(host)).toThrow(/Invalid hostname/);
      });
    });
  });

  describe('rejects invalid edge cases', () => {
    it('rejects empty string', () => {
      expect(() => validateHostname('')).toThrow(/Invalid hostname/);
    });

    it('rejects null', () => {
      expect(() => validateHostname(null)).toThrow(/Invalid hostname/);
    });

    it('rejects undefined', () => {
      expect(() => validateHostname(undefined)).toThrow(/Invalid hostname/);
    });
  });
});
