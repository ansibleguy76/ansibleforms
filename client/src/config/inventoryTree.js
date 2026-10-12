// The Visual tab of the designer's Inventories section : an Ansible inventory (inventory.yaml) as
// a tree of its groups - their child groups, their hosts, how many variables each sets - each with
// the line it starts on, so a click opens the YAML there. Pure : AppInventoryTree draws it.
import YAML from 'yaml';

/** The keys of a map node, as text. */
function keysOf(map) {
  return YAML.isMap(map) ? map.items.map((p) => String(YAML.isScalar(p.key) ? p.key.value : p.key)) : [];
}

/** How many variables a map node sets (0 for none). */
function varsCount(node) {
  return YAML.isMap(node) ? node.items.length : 0;
}

/**
 * An inventory's groups and hosts.
 *
 * Args:
 *   text (string): the inventory, in YAML (all: hosts / children / vars, or groups at the top).
 *
 * Returns:
 *   object: { kind: 'inventory', groups: [group], hosts (how many), error } where a group is
 *     { name, line, vars (how many), hosts: [{ name, line, vars }], children: [group] } ;
 *     kind 'plugin' for a dynamic inventory (plugin: <name>), 'empty', or 'invalid' with the
 *     YAML's first error and its line.
 */
export function inventoryOf(text) {
  const lineCounter = new YAML.LineCounter();
  const doc = YAML.parseDocument(text || '', { lineCounter });
  if (doc.errors.length) {
    const e = doc.errors[0];
    return { kind: 'invalid', error: e.message.split('\n')[0], line: e.linePos?.[0]?.line ?? null };
  }
  const root = doc.contents;
  if (root === null || root === undefined || (YAML.isScalar(root) && root.value === null)) return { kind: 'empty' };
  if (!YAML.isMap(root)) return { kind: 'invalid', error: 'An inventory is a map of groups', line: 1 };
  const lineOf = (node) => (node?.range ? lineCounter.linePos(node.range[0]).line : null);
  // a dynamic inventory : its plugin reads the hosts when the playbook runs
  if (root.has('plugin')) return { kind: 'plugin', plugin: String(root.get('plugin')), line: lineOf(root) };

  const allHosts = new Set();
  const groupOf = (name, node, keyNode, depth) => {
    const group = { name, line: lineOf(keyNode), vars: 0, hosts: [], children: [] };
    if (!YAML.isMap(node) || depth > 20) return group;
    group.vars = varsCount(node.get('vars', true));
    const hosts = node.get('hosts', true);
    if (YAML.isMap(hosts)) {
      for (const p of hosts.items) {
        const host = String(YAML.isScalar(p.key) ? p.key.value : p.key);
        allHosts.add(host);
        group.hosts.push({ name: host, line: lineOf(p.key), vars: varsCount(p.value) });
      }
    }
    const children = node.get('children', true);
    if (YAML.isMap(children)) {
      for (const p of children.items) {
        group.children.push(groupOf(String(YAML.isScalar(p.key) ? p.key.value : p.key), p.value, p.key, depth + 1));
      }
    }
    return group;
  };
  const groups = root.items.map((p) => groupOf(String(YAML.isScalar(p.key) ? p.key.value : p.key), p.value, p.key, 0));
  return { kind: 'inventory', groups, hosts: allHosts.size, keys: keysOf(root) };
}

/**
 * The groups as rows, a child group under its parent, each a level deeper ; a group's hosts
 * under it, after its child groups.
 *
 * Args:
 *   groups (object[]): the groups (inventoryOf).
 *
 * Returns:
 *   object[]: { type: 'group' | 'host', depth, ...the group or host }.
 */
export function inventoryRows(groups) {
  const rows = [];
  const walk = (list, depth, parents) => {
    for (const g of list) {
      const id = [...parents, g.name].join('/');
      rows.push({ type: 'group', depth, id, ...g, count: g.hosts.length + g.children.length });
      walk(g.children, depth + 1, [...parents, g.name]);
      for (const h of g.hosts) rows.push({ type: 'host', depth: depth + 1, id: `${id}#${h.name}`, parent: id, ...h });
    }
  };
  walk(groups, 0, []);
  return rows;
}

/**
 * Where a path of the inventories explorer sits : the inventory folder it belongs to, and what
 * the file is in it.
 *
 * Args:
 *   path (string): the file's path, as the explorer shows it.
 *   prefixed (boolean): the paths start with a repository's name (several repositories).
 *
 * Returns:
 *   object: { inventory (its folder's path, or '' for a file outside any), role : 'inventory'
 *     (its inventory file), 'group_vars', 'host_vars' or 'other', name (the group or host a vars
 *     file is for) }.
 */
export function inventoryFileRole(path, prefixed = false) {
  const parts = String(path || '').split('/');
  const base = prefixed ? 2 : 1;
  if (parts.length < base + 1) return { inventory: '', role: 'other' };
  const inventory = parts.slice(0, base).join('/');
  const rest = parts.slice(base);
  if (rest.length === 1 && /^(inventory|hosts)\.ya?ml$/i.test(rest[0])) return { inventory, role: 'inventory' };
  if (rest.length === 2 && (rest[0] === 'group_vars' || rest[0] === 'host_vars') && /\.ya?ml$/i.test(rest[1])) {
    return { inventory, role: rest[0], name: rest[1].replace(/\.ya?ml$/i, '') };
  }
  return { inventory, role: 'other' };
}
