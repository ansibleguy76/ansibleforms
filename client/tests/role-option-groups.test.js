import { describe, it, expect } from 'vitest';
import { roleOptionGroups, roleOptionKeys } from '@/config/roles';

describe('role option groups', () => {
  it('hold every role option once, in the same order as the list', () => {
    const grouped = roleOptionGroups.flatMap((g) => g.keys);
    expect(grouped).toEqual(roleOptionKeys);
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('each have a name and a title key', () => {
    for (const g of roleOptionGroups) {
      expect(g.name).toBeTruthy();
      expect(g.title).toMatch(/^[a-zA-Z]+\.[a-zA-Z.]+$/);
    }
  });
});
