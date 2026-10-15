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

import { effectiveRoleOption } from '@/config/roles';

describe('what a role option really gives', () => {
  it('an option included in another that is on is on, whatever its own value', () => {
    expect(effectiveRoleOption({ showSettings: true, showAuditLog: false }, 'showAuditLog')).toEqual({
      value: true,
      includedBy: 'showSettings',
      needs: null,
    });
    expect(effectiveRoleOption({ manageAllJobs: true }, 'showAllJobLogs').value).toBe(true);
  });

  it('an option missing the one it needs is off, whatever its own value', () => {
    expect(effectiveRoleOption({ showDesigner: false, allowFormDesign: true }, 'allowFormDesign')).toEqual({
      value: false,
      includedBy: null,
      needs: 'showDesigner',
    });
    expect(
      effectiveRoleOption({ allowApiTokens: false, extendedTokenExpiration: true }, 'extendedTokenExpiration').value,
    ).toBe(false);
  });

  it('else its own value', () => {
    expect(effectiveRoleOption({ showDesigner: true, allowFormDesign: true }, 'allowFormDesign').value).toBe(true);
    expect(effectiveRoleOption({ showLogs: false }, 'showLogs').value).toBe(false);
  });
});
