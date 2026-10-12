// What the settings pages link to a form : the roles that open it and the runners its jobs
// run on, for the Forms tabs of a role, a group, a user and a runner. A form runs where it
// names (`runner: <name>`, `awx: <name>` its deprecated alias), a multistep form where each
// step names ; what names none runs on the default runner of its type (lib/jobTypes.js
// RUNNER_TYPE_OF), as runners/orchestrator.js.
import { RUNNER_TYPE_OF } from './jobTypes.js';

const DEFAULT_TYPE = RUNNER_TYPE_OF;

/**
 * Where one form or one step runs : the runner it names, or the type of the default it takes.
 *
 * Args:
 *   item (object): a form or a step, with type, runner or awx.
 *
 * Returns:
 *   object|null: { runner } when it names one, { defaultType } when it takes the default ;
 *     null for a type that runs nowhere (a multistep form itself, a git job...).
 */
function runsOn(item) {
  const named = item?.runner || item?.awx;
  if (typeof named === 'string' && named.trim()) return { runner: named.trim() };
  const defaultType = DEFAULT_TYPE[item?.type];
  return defaultType ? { defaultType } : null;
}

/**
 * The forms as the settings pages link them : no subform (it is never opened on its own).
 *
 * Args:
 *   forms (object[]): the forms of the full config (Form.load(undefined, undefined, true)).
 *
 * Returns:
 *   object[]: each { name, description, type, roles, runs } - runs, where its jobs run (see
 *     runsOn), once per runner or default type.
 */
export function formLinks(forms) {
  return (Array.isArray(forms) ? forms : [])
    .filter((f) => f && f.name && f.type !== 'subform')
    .map((f) => {
      const steps = f.type === 'multistep' && Array.isArray(f.steps) ? f.steps : [f];
      const runs = [];
      for (const s of steps) {
        const where = runsOn(s);
        if (where && !runs.some((r) => r.runner === where.runner && r.defaultType === where.defaultType)) runs.push(where);
      }
      return {
        name: f.name,
        description: f.description || '',
        type: f.type || '',
        roles: Array.isArray(f.roles) ? f.roles.map(String) : [],
        runs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
