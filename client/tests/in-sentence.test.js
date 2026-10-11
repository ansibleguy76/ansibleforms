// A label inside a sentence : "Add repository", acronyms and German nouns as they are.
import { describe, it, expect } from 'vitest';
import { inSentence } from '@/lib/inSentence';

describe('inSentence', () => {
  it('lowers a word', () => {
    expect(inSentence('Repository', 'en')).toBe('repository');
    expect(inSentence('Mail server', 'en')).toBe('mail server');
    expect(inSentence('Repositorio', 'es')).toBe('repositorio');
  });
  it('keeps an acronym, a name and a German noun', () => {
    expect(inSentence('SSO provider', 'en')).toBe('SSO provider');
    expect(inSentence('LDAP', 'en')).toBe('LDAP');
    expect(inSentence('OAuth2 provider', 'en')).toBe('OAuth2 provider');
    expect(inSentence('Repository', 'de')).toBe('Repository');
    expect(inSentence('リポジトリ', 'ja')).toBe('リポジトリ');
    expect(inSentence('', 'en')).toBe('');
  });
});
