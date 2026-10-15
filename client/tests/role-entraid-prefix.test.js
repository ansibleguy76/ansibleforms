// A role names a Microsoft Entra ID member entraid/<name> since 7.3 ; azuread/<name>, the prefix
// of before, is the same member. The editors read both as the Entra ID provider (azuread, the
// type its sign-in stores) and write entraid/.
import { describe, it, expect } from 'vitest';
import { parseProviderEntry, formatProviderEntry, providerPrefix, roleToEditable, serializeRole } from '@/config/roles';

describe('the entraid/ prefix in the roles editor', () => {
  it('reads entraid/x and azuread/x as the same Entra ID member', () => {
    expect(parseProviderEntry('entraid/AF-Operators')).toEqual({ provider: 'azuread', name: 'AF-Operators' });
    expect(parseProviderEntry('azuread/AF-Operators')).toEqual({ provider: 'azuread', name: 'AF-Operators' });
    expect(parseProviderEntry('ldap/ops')).toEqual({ provider: 'ldap', name: 'ops' });
    expect(parseProviderEntry('admins')).toEqual({ provider: 'local', name: 'admins' });
  });

  it('writes an Entra ID member as entraid/, the others as they were', () => {
    expect(formatProviderEntry({ provider: 'azuread', name: 'AF-Operators' })).toBe('entraid/AF-Operators');
    expect(formatProviderEntry({ provider: 'oidc', name: 'ops' })).toBe('oidc/ops');
    expect(providerPrefix('azuread')).toBe('entraid');
    expect(providerPrefix('local')).toBe('local');
  });

  it('serializes a role of before with entraid/, new and existing members alike', () => {
    const role = roleToEditable({
      name: 'operators',
      groups: ['azuread/AF-Operators', 'entraid/AF-Admins', 'local/ops'],
      users: ['azuread/alice@example.com'],
    });
    role.groups.push({ provider: 'azuread', name: 'AF-New' });
    const out = serializeRole(role);
    expect(out.groups).toEqual(['entraid/AF-Operators', 'entraid/AF-Admins', 'local/ops', 'entraid/AF-New']);
    expect(out.users).toEqual(['entraid/alice@example.com']);
  });
});
