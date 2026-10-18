// A record's first tab renamed (a role's and an LDAP directory's General, now Details) keeps its
// old address : /general redirects to the record's plain address, which opens Details, so a link
// or a bookmark from before still lands on the tab it named.
import { describe, it, expect } from 'vitest';
import router from '@/router';

describe('the general tab alias', () => {
  it.each([
    ['/settings/roles/admin/general', '/settings/roles/:name', { name: 'admin' }],
    ['/settings/ldap/3/general', '/settings/ldap/:id', { id: '3' }],
  ])('%s redirects to the record', (path, name, params) => {
    const record = router.resolve(path).matched.at(-1);
    expect(typeof record.redirect).toBe('function');
    const target = record.redirect({ params, query: { q: '1' } });
    expect(target).toEqual({ name, params, query: { q: '1' } });
    // and the target is the record's page, its first tab
    expect(router.resolve(target).params.tab).toBeFalsy();
  });

  it('leaves the other tabs alone', () => {
    expect(router.resolve('/settings/roles/admin/users').params.tab).toBe('users');
    expect(router.resolve('/settings/ldap/3/users').params.tab).toBe('users');
  });
});
