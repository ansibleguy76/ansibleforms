// lib/jobNotifications.js : what a look tells - the user's jobs that ended since the last look,
// the jobs that now wait for its approval - each once, the first look telling nothing.
import { describe, it, expect, beforeEach } from 'vitest';
import { whatIsNew, mayApprove, mayDecide, turnNotificationsOff } from '@/lib/jobNotifications';

const me = { username: 'anna', type: 'local', roles: ['public'] };
const job = (id, status, extra = {}) => ({ id, status, user: 'anna', user_type: 'local', form: 'Patch', ...extra });

describe('a look at the jobs', () => {
  // forgets what was seen : each test starts with a first look
  beforeEach(() => turnNotificationsOff());

  it('the first look tells nothing : jobs that ended before stay quiet', () => {
    expect(whatIsNew([job(1, 'success'), job(2, 'running')], [], me)).toEqual({ ended: [], approve: [] });
  });

  it('a job seen running and now ended is told once', () => {
    whatIsNew([job(2, 'running')], [], me);
    expect(whatIsNew([job(2, 'failed')], [], me).ended.map((j) => j.id)).toEqual([2]);
    expect(whatIsNew([job(2, 'failed')], [], me).ended).toEqual([]);
  });

  it('a job launched since and ended at once is told ; an older one never seen is not', () => {
    whatIsNew([job(5, 'success')], [], me);
    const { ended } = whatIsNew([job(6, 'success'), job(5, 'success'), job(3, 'aborted')], [], me);
    expect(ended.map((j) => j.id)).toEqual([6]);
  });

  it("a multistep job's steps stay quiet : its own job tells", () => {
    whatIsNew([job(7, 'running'), job(8, 'running', { parent_id: 7 })], [], me);
    const { ended } = whatIsNew([job(7, 'success'), job(8, 'success', { parent_id: 7 })], [], me);
    expect(ended.map((j) => j.id)).toEqual([7]);
  });

  it('a job now waiting for its approval is told once ; its own waiting job is not', () => {
    whatIsNew([], [job(10, 'running', { user: 'bob' })], me);
    const first = whatIsNew([], [job(10, 'approve', { user: 'bob' }), job(11, 'approve')], me);
    expect(first.approve.map((j) => j.id)).toEqual([10]);
    expect(whatIsNew([], [job(10, 'approve', { user: 'bob' })], me).approve).toEqual([]);
  });
});

describe('who may approve', () => {
  it('an admin any job, else one of the roles the approval names', () => {
    const approval = JSON.stringify({ roles: ['ops'] });
    expect(mayApprove({ approval }, { roles: ['admin'] })).toBe(true);
    expect(mayApprove({ approval }, { roles: ['ops'] })).toBe(true);
    expect(mayApprove({ approval: { roles: ['ops'] } }, { roles: ['ops'] })).toBe(true);
    expect(mayApprove({ approval }, { roles: ['public'] })).toBe(false);
    expect(mayApprove({}, { roles: ['public'] })).toBe(true);
    expect(mayApprove({ approval: '{broken' }, { roles: ['public'] })).toBe(false);
  });

  it('not their own job, unless the approval allows it or they are an admin (four eyes)', () => {
    const me = { username: 'alice', type: 'local', roles: ['ops'] };
    const own = { user: 'alice', user_type: 'local', approval: JSON.stringify({ roles: ['ops'] }) };
    expect(mayApprove(own, me)).toBe(false);
    // Reject (withdrawing it) stays theirs
    expect(mayDecide(own, me)).toBe(true);
    expect(mayApprove({ ...own, approval: { roles: ['ops'], allowSelf: true } }, me)).toBe(true);
    expect(mayApprove(own, { ...me, roles: ['admin'] })).toBe(true);
    // the same name from another login type is somebody else
    expect(mayApprove({ ...own, user_type: 'ldap' }, me)).toBe(true);
  });
});
