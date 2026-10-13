import { describe, it, expect } from 'vitest';
import { ssoCallbackPath, ssoCallbackUrl, ssoCallbackBase } from '@/lib/ssoCallback';

describe('ssoCallback', () => {
  it('gives each provider type its callback path', () => {
    expect(ssoCallbackPath('azuread')).toBe('/api/v2/auth/azureadoauth2/callback');
    expect(ssoCallbackPath('oidc')).toBe('/api/v2/auth/oidc/callback');
    expect(ssoCallbackPath('other')).toBe('');
  });

  it('joins the address and the callback path, without a double slash', () => {
    expect(ssoCallbackUrl('oidc', 'https://forms.example.com/')).toBe(
      'https://forms.example.com/api/v2/auth/oidc/callback',
    );
    expect(ssoCallbackUrl('azuread', ' https://forms.example.com/af ')).toBe(
      'https://forms.example.com/af/api/v2/auth/azureadoauth2/callback',
    );
  });

  it('gives no bare path without an address', () => {
    expect(ssoCallbackUrl('azuread', '')).toBe('');
    expect(ssoCallbackUrl('azuread', undefined)).toBe('');
  });

  it('splits a saved redirect URL back to its address', () => {
    expect(ssoCallbackBase('azuread', 'https://forms.example.com/api/v2/auth/azureadoauth2/callback')).toBe(
      'https://forms.example.com',
    );
    expect(ssoCallbackBase('oidc', 'https://forms.example.com/af/api/v2/auth/oidc/callback')).toBe(
      'https://forms.example.com/af',
    );
    expect(ssoCallbackBase('oidc', '')).toBe('');
    expect(ssoCallbackBase('oidc', null)).toBe('');
  });

  it('keeps the split and the join a round trip', () => {
    const url = 'https://sso.example.org/api/v2/auth/oidc/callback';
    expect(ssoCallbackUrl('oidc', ssoCallbackBase('oidc', url))).toBe(url);
  });
});
