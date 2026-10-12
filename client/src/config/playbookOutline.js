// The Visual tab of the designer's Playbooks section : a playbook as its outline - its plays (or
// the playbooks it imports), each with its hosts, its roles, and its tasks in their sections
// (pre_tasks, tasks, post_tasks, handlers), a block's tasks under it (and its rescue and always),
// each task with its name, its module and the line it starts on. Pure : AppPlaybookOutline draws
// it, a click opens the YAML on a line.
import YAML from 'yaml';

// a play's task lists, in the order ansible runs them (handlers last : when notified)
export const PLAY_SECTIONS = ['pre_tasks', 'tasks', 'post_tasks', 'handlers'];
// a block's own lists
const BLOCK_SECTIONS = ['block', 'rescue', 'always'];

// what a task may say that is not its module : ansible's task keywords
const TASK_KEYWORDS = new Set([
  'name',
  'action',
  'args',
  'any_errors_fatal',
  'async',
  'become',
  'become_exe',
  'become_flags',
  'become_method',
  'become_user',
  'changed_when',
  'check_mode',
  'collections',
  'connection',
  'debugger',
  'delay',
  'delegate_facts',
  'delegate_to',
  'diff',
  'environment',
  'failed_when',
  'ignore_errors',
  'ignore_unreachable',
  'listen',
  'local_action',
  'loop',
  'loop_control',
  'module_defaults',
  'no_log',
  'notify',
  'poll',
  'port',
  'register',
  'remote_user',
  'retries',
  'run_once',
  'tags',
  'throttle',
  'timeout',
  'until',
  'vars',
  'when',
  'block',
  'rescue',
  'always',
]);

/** The text of a scalar node, '' when it is something else. */
function textOf(node) {
  if (YAML.isScalar(node)) return node.value === null || node.value === undefined ? '' : String(node.value);
  return '';
}

/**
 * A task's module : its first key that is not a task keyword (nor a with_ loop).
 *
 * Args:
 *   task (YAML.YAMLMap): the task.
 *
 * Returns:
 *   string: the module ('' when it has none : a block, or a task of keywords only).
 */
function moduleOf(task) {
  for (const p of task.items) {
    const key = textOf(p.key);
    if (key && !TASK_KEYWORDS.has(key) && !key.startsWith('with_')) return key;
  }
  const action = task.get('action', true) || task.get('local_action', true);
  return textOf(action).split(/\s+/)[0] || (YAML.isMap(action) ? textOf(action.get('module', true)) : '');
}

/**
 * The tasks of a list, a block's under it.
 *
 * Args:
 *   seq (any): the list's YAML node.
 *   lineOf (function): a node's line.
 *   depth (number): how deep in blocks (a limit, against a document that loops through anchors).
 *
 * Returns:
 *   object[]: { kind : 'task' | 'block', name, module, line, sections : [{ key, tasks }] (a
 *     block's : block, rescue, always), include (an imported or included file, when it is one) }.
 */
function tasksOf(seq, lineOf, depth = 0) {
  if (!YAML.isSeq(seq) || depth > 10) return [];
  return seq.items.filter(YAML.isMap).map((task) => {
    const name = textOf(task.get('name', true));
    if (task.has('block')) {
      return {
        kind: 'block',
        name,
        line: lineOf(task),
        sections: BLOCK_SECTIONS.filter((k) => task.has(k)).map((k) => ({
          key: k,
          tasks: tasksOf(task.get(k, true), lineOf, depth + 1),
        })),
      };
    }
    const module = moduleOf(task);
    // an included or imported file, a role : what it brings in
    const target = task.get(module, true);
    const include = /^(ansible\.builtin\.)?(include_tasks|import_tasks|include_role|import_role|include_vars)$/.test(
      module,
    )
      ? textOf(target) ||
        (YAML.isMap(target) ? textOf(target.get('name', true)) || textOf(target.get('file', true)) : '')
      : '';
    return { kind: 'task', name, module, line: lineOf(task), include };
  });
}

/**
 * The roles of a play : by name, or as maps (role: name, or name: name).
 *
 * Args:
 *   seq (any): the roles' YAML node.
 *   lineOf (function): a node's line.
 *
 * Returns:
 *   object[]: { name, line }.
 */
function rolesOf(seq, lineOf) {
  if (!YAML.isSeq(seq)) return [];
  return seq.items
    .map((r) => ({
      name: YAML.isMap(r) ? textOf(r.get('role', true)) || textOf(r.get('name', true)) : textOf(r),
      line: lineOf(r),
    }))
    .filter((r) => r.name);
}

/**
 * How many tasks a list holds, a block's counted in.
 *
 * Args:
 *   tasks (object[]): the tasks (tasksOf).
 *
 * Returns:
 *   number: how many.
 */
export function taskCount(tasks) {
  return tasks.reduce(
    (n, t) => n + (t.kind === 'block' ? t.sections.reduce((m, s) => m + taskCount(s.tasks), 0) : 1),
    0,
  );
}

/**
 * A playbook's outline.
 *
 * Args:
 *   text (string): the playbook, in YAML.
 *
 * Returns:
 *   object: { kind : 'playbook', plays : [{ kind : 'play' | 'import', name, hosts, line,
 *     become, gather_facts, roles, sections : [{ key, tasks }] }] } ; 'empty' ; or 'invalid'
 *     (with error and line) - not YAML, or not a list of plays.
 */
export function playbookOutline(text) {
  const lineCounter = new YAML.LineCounter();
  const doc = YAML.parseDocument(text || '', { lineCounter });
  if (doc.errors.length) {
    const e = doc.errors[0];
    return { kind: 'invalid', error: e.message.split('\n')[0], line: e.linePos?.[0]?.line ?? null };
  }
  const root = doc.contents;
  if (root === null || root === undefined || (YAML.isScalar(root) && root.value === null)) return { kind: 'empty' };
  if (!YAML.isSeq(root)) return { kind: 'invalid', error: 'A playbook is a list of plays', line: 1 };
  const lineOf = (node) => (node?.range ? lineCounter.linePos(node.range[0]).line : null);
  const plays = root.items.filter(YAML.isMap).map((play) => {
    const imported =
      textOf(play.get('import_playbook', true)) || textOf(play.get('ansible.builtin.import_playbook', true));
    if (imported) return { kind: 'import', name: imported, line: lineOf(play) };
    return {
      kind: 'play',
      name: textOf(play.get('name', true)),
      hosts:
        textOf(play.get('hosts', true)) ||
        (YAML.isSeq(play.get('hosts', true)) ? play.get('hosts', true).items.map(textOf).join(', ') : ''),
      become: textOf(play.get('become', true)) === 'true',
      gather_facts: play.has('gather_facts') ? textOf(play.get('gather_facts', true)) !== 'false' : true,
      line: lineOf(play),
      roles: rolesOf(play.get('roles', true), lineOf),
      sections: PLAY_SECTIONS.filter((k) => play.has(k)).map((k) => ({
        key: k,
        tasks: tasksOf(play.get(k, true), lineOf),
      })),
    };
  });
  return { kind: 'playbook', plays };
}
