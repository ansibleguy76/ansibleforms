// The toast after "Ask again" on a disclaimer : when are those users asked ?
//
// The server clears their acceptance and the disclaimer gate (lib/middleware.js) stops
// their very next request, so they accept it on the next page they open or the next
// action they take. The toast said "at their next sign-in" in every
// language, which made admins think a user already signed in would keep working until
// the session ends.
import { describe, it, expect } from 'vitest';

const LANGS = ['en', 'de', 'fr', 'it', 'es', 'nl', 'ca', 'pt', 'ja', 'zh', 'pl'];

// How each language said "sign-in" / "login" in the old text
const SIGN_IN =
  /sign.?in|log.?in|connexion|anmeldung|inicio de sesión|inici de sessió|início de sessão|accesso|aanmelding|logowani|サインイン|ログイン|登录/i;

describe('the disclaimer ask-again toast', () => {
  for (const lang of LANGS) {
    it(`does not promise a next sign-in (${lang})`, async () => {
      const text = (await import(`../src/locales/${lang}.js`)).default.settings.disclaimer.askAgainDone;
      expect(text).toContain('{count}');
      expect(text).not.toMatch(SIGN_IN);
    });
  }
});
