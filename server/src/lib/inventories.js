// A playbook form's inventory by name : `inventory: production` is the inventory of that name -
// a repository used for inventories (it IS the inventory : inventory.yaml, group_vars and
// host_vars at its root), or a folder of the local inventories folder (INVENTORY_PATH).
// ansible-playbook gets that folder (-i <folder>) : it reads the inventory in it and the
// group_vars and host_vars beside it. Anything else - a path, a file - goes to ansible as it is,
// as before.
import path from "path";

// a name : one segment, no path
const NAME = /^[\p{L}\p{N}_@+=,~-][\p{L}\p{N}_.@+=,~-]*$/u;

/**
 * The folder an inventory name stands for, or the value as it is.
 *
 * Args:
 *   item (string): what the form says (inventory: production, or a path).
 *   roots (object[]): where inventories are : { repository (a repository that is an inventory,
 *     or null for the local folder holding one folder per inventory), root }.
 *   isDir (function): whether a path is a folder (fs.statSync in use, a fake in tests).
 *
 * Returns:
 *   string: the inventory's folder when the value names one, else the value.
 *
 * Raises:
 *   Error: the name is both a repository and a folder of the local inventories folder.
 */
export function resolveInventory(item, roots, isDir) {
  if (typeof item !== "string") return item;
  const value = item.trim();
  if (!NAME.test(value) || value === "..") return item;
  const found = [];
  for (const r of roots || []) {
    if (r.repository) {
      if (r.repository === value && isDir(r.root)) found.push({ r, dir: r.root });
    } else if (isDir(path.join(r.root, value))) {
      found.push({ r, dir: path.join(r.root, value) });
    }
  }
  if (found.length > 1) {
    throw new Error(`Inventory '${value}' is both a repository and a folder of the inventories folder (INVENTORY_PATH) : rename one of them`);
  }
  return found.length ? found[0].dir : item;
}
