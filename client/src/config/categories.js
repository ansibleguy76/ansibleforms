// Pure operations on the category tree, shared by the settings Categories page
// (through useFormsConfig) and the designer's Edit categories modal. Keep them
// pure so both editors move a category by exactly the same rules.
//
// A category is addressed by its slash-joined PATH : a form carries
// `categories: [Infra/Databases]` and AppMenuItem matches on that path. So a
// move is not a cosmetic reordering - it renames the category and every one of
// its descendants, and any form still pointing at the old path stops appearing
// under it. movedCategoryPaths() is what the editors show for that.

// base_schema.json pins one entry : `categories` must CONTAIN exactly
// {name: 'Default', icon: 'bars'}. `const` is an equality match, so that row may
// not be renamed, restyled, moved off the top level OR given an `items` key -
// any of those makes every save fail on a raw schema error.
export function isDefaultCategory(cat, depth) {
  return depth === 0 && cat?.name === 'Default' && cat?.icon === 'bars';
}

export function flattenCategories(cats, depth = 0) {
  const result = [];
  for (const cat of cats || []) {
    result.push({ cat, depth });
    if (cat.items && cat.items.length > 0) {
      result.push(...flattenCategories(cat.items, depth + 1));
    }
  }
  return result;
}

// Where a category sits : the array holding it and its index, plus the category
// that owns that array and the array THAT one sits in (outdent needs both).
// Identity based, never by name : two categories under different parents may
// share a name, and a half-typed one has no name at all.
function locate(tree, target, parent = null, parentList = null) {
  const list = tree || [];
  const index = list.indexOf(target);
  if (index >= 0) return { list, index, parent, parentList };
  for (const cat of list) {
    if (cat.items && cat.items.length > 0) {
      const hit = locate(cat.items, target, cat, list);
      if (hit) return hit;
    }
  }
  return null;
}

export function canMoveUp(tree, target) {
  const at = locate(tree, target);
  return !!at && at.index > 0;
}

export function canMoveDown(tree, target) {
  const at = locate(tree, target);
  return !!at && at.index < at.list.length - 1;
}

// Indent makes the previous SIBLING the new parent, so there has to be one.
// Neither end may be the Default category : it would either leave the top level
// or gain an `items` key.
export function canIndent(tree, target) {
  const at = locate(tree, target);
  if (!at || at.index === 0) return false;
  if (!at.parent && isDefaultCategory(target, 0)) return false;
  const previous = at.list[at.index - 1];
  if (!at.parent && isDefaultCategory(previous, 0)) return false;
  return true;
}

export function canOutdent(tree, target) {
  const at = locate(tree, target);
  return !!at && !!at.parent;
}

export function moveCategoryUp(tree, target) {
  if (!canMoveUp(tree, target)) return false;
  const { list, index } = locate(tree, target);
  list.splice(index - 1, 0, list.splice(index, 1)[0]);
  return true;
}

export function moveCategoryDown(tree, target) {
  if (!canMoveDown(tree, target)) return false;
  const { list, index } = locate(tree, target);
  list.splice(index + 1, 0, list.splice(index, 1)[0]);
  return true;
}

export function indentCategory(tree, target) {
  if (!canIndent(tree, target)) return false;
  const { list, index } = locate(tree, target);
  const previous = list[index - 1];
  list.splice(index, 1);
  if (!previous.items) previous.items = [];
  previous.items.push(target);
  return true;
}

export function outdentCategory(tree, target) {
  if (!canOutdent(tree, target)) return false;
  const { list, index, parent, parentList } = locate(tree, target);
  list.splice(index, 1);
  // directly AFTER the old parent, which is where it reads as having come from
  parentList.splice(parentList.indexOf(parent) + 1, 0, target);
  // an emptied `items` is dropped on serialize anyway ; removing it here keeps
  // the editor's own idea of "has children" honest while the modal is open
  if (parent.items && parent.items.length === 0) delete parent.items;
  return true;
}

// Every path in the tree, in tree order.
export function categoryPaths(cats, prefix = '') {
  const result = [];
  for (const cat of cats || []) {
    const name = String(cat.name ?? '').trim();
    if (!name) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    result.push(path);
    if (cat.items && cat.items.length > 0) result.push(...categoryPaths(cat.items, path));
  }
  return result;
}

// Paths that existed before and do not exist now, i.e. the ones a form may still
// be pointing at. Renaming has always been able to do this ; moving is simply
// the second way, which is why the editors say so rather than refuse.
export function movedCategoryPaths(before, after) {
  const now = new Set(categoryPaths(after));
  return categoryPaths(before).filter((path) => !now.has(path));
}
