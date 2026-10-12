// A playbook form's inventory by name : `inventory: production` is the inventory folder of that
// name (production/inventory.yaml with its group_vars and host_vars), in the inventories folder
// or one of the inventories repositories. ansible-playbook gets the folder (-i <folder>) : it
// reads the inventory in it and the group_vars and host_vars beside it. Anything else - a path,
// a file - goes to ansible as it is, as before.
import path from "path";

// a name, or repository/name when several repositories hold inventories
const NAME = /^[\p{L}\p{N}_@+=,~-][\p{L}\p{N}_.@+=,~-]*(\/[\p{L}\p{N}_@+=,~-][\p{L}\p{N}_.@+=,~-]*)?$/u;

/**
 * The folder an inventory name stands for, or the value as it is.
 *
 * Args:
 *   item (string): what the form says (inventory: production, or a path).
 *   roots (object[]): the inventories folders : { repository (name or null), root }.
 *   isDir (function): whether a path is a folder (fs.statSync in use, a fake in tests).
 *
 * Returns:
 *   string: the inventory folder's absolute path when the value names one, else the value.
 *
 * Raises:
 *   Error: the name is an inventory in several repositories (name it repository/name).
 */
export function resolveInventory(item, roots, isDir) {
  if (typeof item !== "string") return item;
  const value = item.trim();
  if (!NAME.test(value) || value.split("/").includes("..")) return item;
  const parts = value.split("/");
  const found = [];
  for (const r of roots || []) {
    if (parts.length === 2) {
      // repository/name
      if (r.repository === parts[0] && isDir(path.join(r.root, parts[1]))) found.push({ r, dir: path.join(r.root, parts[1]) });
    } else if (isDir(path.join(r.root, value))) {
      found.push({ r, dir: path.join(r.root, value) });
    }
  }
  if (found.length > 1) {
    const where = found.map((f) => f.r.repository || "the inventories folder").join(", ");
    throw new Error(`Inventory '${value}' is in several repositories (${where}) : name it <repository>/${value}`);
  }
  return found.length ? found[0].dir : item;
}
