// The buttons a record's page will have, for their placeholders while it loads
// (lib/recordButtons.js) : from the record's row of its list when it was read in this tab, else
// the usual case. A wrong guess makes the page jump when the real buttons come.
import { describe, it, expect, beforeEach } from 'vitest';
import { recordButtons, rememberRows } from '@/lib/recordButtons';
import { forgetMenus } from '@/lib/menuMemory';

describe('the buttons of a record page', () => {
  beforeEach(() => forgetMenus());

  it('a runner of the seed : Test connection only', () => {
    rememberRows('runner', [{ id: 1, managed: 1 }]);
    expect(recordButtons('runners', '1')).toHaveLength(1);
  });

  it('a runner made in the app : Test, Delete and Save (its token in its tab) ; for an admin only', () => {
    rememberRows('runner', [{ id: 2, managed: 0 }]);
    expect(recordButtons('runners', 2)).toHaveLength(3);
    expect(recordButtons('runners', 2, false)).toHaveLength(1);
  });

  it('a runner not known : the button every runner has', () => {
    expect(recordButtons('runners', 9)).toHaveLength(1);
  });

  it('a credential : Test for a database, then Delete and Save (its password in its Login tab)', () => {
    rememberRows('credential', [
      { id: 1, is_database: 1, credential_type: 'database' },
      { id: 2, credential_type: 'ssh' },
      { id: 3, credential_type: 'ssh', secret_store: 'vault' },
      { id: 4, credential_type: 'cyberark' },
      { id: 5, credential_type: 'ssh', managed: 1 },
    ]);
    expect([1, 2, 3, 4, 5].map((id) => recordButtons('credentials', id).length)).toEqual([3, 2, 2, 2, 0]);
  });

  it('a credential not known : Delete and Save', () => {
    expect(recordButtons('credentials', 7)).toHaveLength(2);
  });

  it('a seeded secret store, channel or syslog server loses Delete and Save', () => {
    rememberRows('secretstore', [{ id: 1, managed: 1 }]);
    rememberRows('notificationchannel', [{ id: 1, managed: 1 }]);
    rememberRows('syslogserver', [{ id: 1, managed: 0 }]);
    expect(recordButtons('secret-stores', 1)).toHaveLength(1);
    expect(recordButtons('notifications', 1)).toHaveLength(1);
    expect(recordButtons('syslog', 1)).toHaveLength(3);
  });

  it('a repository has the same buttons with its own login or a credential (the password in its tab)', () => {
    rememberRows('repository', [{ id: 1 }, { id: 2, user: 'git', credential: null }]);
    expect(recordButtons('repositories', 1)).toHaveLength(5);
    expect(recordButtons('repositories', 2)).toHaveLength(5);
  });

  it('a reserved role has no Delete', () => {
    expect(recordButtons('roles', 'admin')).toHaveLength(1);
    expect(recordButtons('roles', 'operators')).toHaveLength(2);
  });
});
