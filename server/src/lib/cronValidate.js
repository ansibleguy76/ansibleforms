'use strict';
import { Cron } from 'croner';
import Errors from './errors.js';

// Refuse a cron expression the scheduler cannot run, at the point it would be STORED.
//
// cron.service.js validates too, but only when it registers the task - and there a
// failure is a log line and a `return`. The row is already saved by then, so the
// repository, datasource or schedule simply never runs again and nothing on any page
// says why. That is the quietest failure in the product: a sync that has stopped looks
// exactly like a sync that has nothing to do.
//
// So the check moves to the write. It is the same construction cron.service.js performs,
// which makes croner itself the authority rather than a second implementation of its
// grammar - the client's config/cron.js is the early, explanatory answer and this is the
// one that decides.
//
// An EMPTY value is accepted: "no schedule" is legitimate on all three tables, and
// whether the field is required is a separate question.

export function cronError(expression) {
  const v = String(expression ?? '').trim();
  if (!v) return null;
  try {
    // paused, so nothing is scheduled by the act of checking - the same call
    // cron.service.js makes to test an expression before registering it
    const test = new Cron(v, { paused: true });
    // a pattern that compiles but can never occur again (30 february) would register and
    // then never fire, which is the failure this exists to prevent
    if (!test.nextRun()) {
      test.stop();
      return `'${v}' has no next occurrence, so it would never run`;
    }
    test.stop();
    return null;
  } catch (e) {
    return e.message || `'${v}' is not a valid cron expression`;
  }
}

export function assertValidCron(expression) {
  const problem = cronError(expression);
  if (problem) throw new Errors.BadRequestError(`Invalid cron expression : ${problem}`);
}

export default { cronError, assertValidCron };
