// The Vars files section's Visual tab : what a file is, and its variables edited without losing
// its comments.
import { describe, it, expect } from 'vitest';
import { varsKind, varsRows, setVar, deleteVar, addVar } from '@/config/varsFile';

describe('varsKind', () => {
  it('tells variables, an empty file, anything else and a broken one', () => {
    expect(varsKind('a: 1\n').kind).toBe('vars');
    expect(varsKind('---\n').kind).toBe('empty');
    expect(varsKind('- a\n').kind).toBe('other');
    expect(varsKind('a: [\n')).toMatchObject({ kind: 'invalid', line: expect.any(Number) });
  });
});

describe('a vars file', () => {
  const vars = `# the web tier
port: 80 # the port
debug: false
name: "web"
users:
  - alice
servers:
  a: 1
`;
  it('reads its variables as rows', () => {
    const rows = varsRows(vars);
    expect(rows.map((r) => [r.id, r.type, r.depth])).toEqual([
      ['["port"]', 'number', 0],
      ['["debug"]', 'boolean', 0],
      ['["name"]', 'string', 0],
      ['["users"]', 'seq', 0],
      ['["users",0]', 'string', 1],
      ['["servers"]', 'map', 0],
      ['["servers","a"]', 'number', 1],
    ]);
    expect(rows[0]).toMatchObject({ value: 80, line: 2 });
  });
  it('changes a value and keeps the comments and the quoting', () => {
    const out = setVar(vars, ['port'], 8080);
    expect(out).toContain('# the web tier');
    expect(out).toContain('port: 8080 # the port');
    expect(setVar(vars, ['name'], 'api')).toContain('name: "api"');
  });
  it('deletes and adds keys and list items', () => {
    expect(deleteVar(vars, ['debug'])).not.toContain('debug');
    expect(addVar(vars, [], 'region', 'eu')).toContain('region: eu');
    expect(addVar(vars, ['users'], '', 'bob')).toContain('- bob');
    expect(() => addVar(vars, [], 'port', 1)).toThrow('exists');
    expect(addVar('', [], 'a', 1)).toBe('a: 1\n');
  });
});
