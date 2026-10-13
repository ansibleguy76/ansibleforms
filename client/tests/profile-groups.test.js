// #1036 : the token carries no groups any more (they made it too large for a request header).
// The profile page and a form's __user__ read them from the store's profile, which takes them
// from the server (/api/v2/profile) ; a token issued before carries its own.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const http = vi.hoisted(() => ({ profile: null, gets: 0 }));
vi.mock('axios', () => ({
  default: {
    get: async () => {
      http.gets++;
      return { data: http.profile };
    },
  },
}));
const token = vi.hoisted(() => ({ user: null }));
vi.mock('@/lib/TokenStorage', () => ({ default: { getPayload: () => ({ user: token.user }) } }));

const { useAppStore } = await import('@/stores/app');
const { default: State } = await import('@/lib/State');
const { default: Profile } = await import('@/lib/Profile');

beforeEach(() => {
  setActivePinia(createPinia());
  http.gets = 0;
});

describe('the profile and its groups', () => {
  it('a token without groups : the profile asks the server for them', async () => {
    token.user = { username: 'alice', type: 'azuread', roles: ['operators'] };
    http.profile = { ...token.user, groups: ['azuread/SG-Operators'] };
    State.loadProfile();
    await vi.waitFor(() => expect(useAppStore().profile.groups).toEqual(['azuread/SG-Operators']));
    expect(useAppStore().profile.roles).toEqual(['operators']);
  });

  it('loading the profile again keeps the groups of the same user, not of another one', async () => {
    const store = useAppStore();
    token.user = { username: 'alice', type: 'azuread' };
    store.profile = { username: 'alice', type: 'azuread', groups: ['azuread/a'] };
    http.profile = null;
    State.loadProfile();
    expect(store.profile.groups).toEqual(['azuread/a']);
    token.user = { username: 'bob', type: 'ldap' };
    State.loadProfile();
    expect(store.profile.groups).toBeUndefined();
  });

  it('a token issued before carries its groups : no call', () => {
    token.user = { username: 'carol', type: 'ldap', groups: ['ldap/netops'] };
    State.loadProfile();
    expect(useAppStore().profile.groups).toEqual(['ldap/netops']);
    expect(http.gets).toBe(0);
  });

  it("the server's answer for another user is not put on the profile", async () => {
    const store = useAppStore();
    store.profile = { username: 'alice', type: 'azuread' };
    http.profile = { username: 'mallory', type: 'local', groups: ['local/admins'] };
    await Profile.load();
    expect(store.profile.groups).toBeUndefined();
  });
});
