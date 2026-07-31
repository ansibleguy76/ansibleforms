<script setup>
import { ref, computed, onMounted } from "vue";
import Profile from "@/lib/Profile";
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import { useFormsConfig, DEFAULT_CATEGORY_ICON } from '@/composables/useFormsConfig';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { availableIcons } from '@/config/icons';

const { t } = useI18n();
const authenticated = ref(false);
const { categories, load, save, isCategoriesDirty, parseError, isTemplated, loadError, nextUid } = useFormsConfig();

// This page had no unsaved-changes guard at all : navigating away or reloading threw
// the whole edit away silently. See useUnsavedGuard.
useUnsavedGuard(isCategoriesDirty, () => t('settings.common.unsavedChanges'));

const readOnly = computed(() => parseError.value || isTemplated.value || !!loadError.value);

function isDefaultCategory(cat, depth) {
  return depth === 0 && cat.name === 'Default' && cat.icon === 'bars';
}

function flattenCategories(cats, depth = 0) {
  const result = [];
  for (const cat of cats) {
    result.push({ cat, depth });
    if (cat.items && cat.items.length > 0) {
      result.push(...flattenCategories(cat.items, depth + 1));
    }
  }
  return result;
}

const flatCats = computed(() => flattenCategories(categories.value));

// Same rule the server enforces on every category, at any depth
// (server/schema/base_schema.json, /category name pattern) : 2 to 50 characters
// and no slash. Checked here so the save is blocked with a readable message
// instead of a raw schema error.
// The 'u' flag is not cosmetic : ajv compiles schema patterns with it, so it
// counts code points. Without it a single emoji reads as 2 characters and slips
// past this check only to be refused by the server, and a 26 emoji name is
// blocked here even though the server accepts it.
const categoryNameRegex = /^[^/]{2,50}$/u;

// Returns the first offending row (1-based, in table order) or null. The name is
// tested TRIMMED, exactly as it gets serialized : the pattern alone accepts a
// whitespace-only name, which is schema-valid but renders as a blank menu entry.
function findInvalidCategory() {
  const rows = flatCats.value;
  for (let i = 0; i < rows.length; i++) {
    const name = (rows[i].cat.name || '').trim();
    if (!categoryNameRegex.test(name)) return { row: i + 1, name };
  }
  return null;
}

// Sibling names must be unique : a category is addressed by its slash-joined
// path (a form's `categories: [Parent/Child]`, AppMenuItem.inCategory), so two
// siblings sharing a name are the same path and cannot be told apart, and the
// menu even keys its root entries on the name. The schema has no such rule and
// the same name under different parents is a different path, so this is a UX
// guard scoped to siblings only -- it never rejects a config the server accepts
// for any other reason.
function findDuplicateCategory(cats) {
  const seen = new Set();
  for (const cat of cats) {
    const name = (cat.name || '').trim();
    if (name) {
      if (seen.has(name)) return name;
      seen.add(name);
    }
    if (cat.items && cat.items.length > 0) {
      const duplicate = findDuplicateCategory(cat.items);
      if (duplicate) return duplicate;
    }
  }
  return null;
}

function addCategory() {
  categories.value.push({ _uid: nextUid(), name: '', icon: DEFAULT_CATEGORY_ICON });
}

function addSubcategory(parentCat) {
  if (!parentCat.items) parentCat.items = [];
  parentCat.items.push({ _uid: nextUid(), name: '', icon: DEFAULT_CATEGORY_ICON });
}

function removeCategory(cat, list) {
  if (!list) list = categories.value;
  const idx = list.indexOf(cat);
  if (idx >= 0) {
    list.splice(idx, 1);
    return true;
  }
  for (const item of list) {
    if (item.items && removeCategory(cat, item.items)) return true;
  }
  return false;
}

async function saveCategories() {
  const invalid = findInvalidCategory();
  if (invalid) {
    toast.warning(t('settings.settingsPage.invalidCategoryName', invalid));
    return;
  }
  const duplicate = findDuplicateCategory(categories.value);
  if (duplicate) {
    toast.warning(t('settings.settingsPage.duplicateCategoryName', { name: duplicate }));
    return;
  }
  await save(t('settings.settingsPage.categories'));
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await load();
});
</script>
<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex flex-nowrap container-xxl">
      <AppSidebar />
      <AppSettings v-if="authenticated" icon="th-list" :title="t('settings.settingsPage.categories')" :description="t('settings.settingsPage.categoriesDescription')">
        <template #default>
          <div class="pt-2">
            <div v-if="loadError" class="alert alert-danger" role="alert">
              {{ t('settings.common.failedToLoad') }} : {{ loadError }}
            </div>
            <div v-if="categories.length === 0" class="empty-state">
              <FaIcon icon="th-list" class="empty-state-icon" />
              <span>{{ t('settings.settingsPage.noCategories') }}</span>
            </div>
            <table v-else class="table table-sm table-bordered mb-2 config-table">
              <thead>
                <tr>
                  <th>{{ t('settings.settingsPage.name') }}</th>
                  <th>{{ t('settings.settingsPage.icon') }}</th>
                  <th class="col-action"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in flatCats" :key="row.cat._uid">
                  <td>
                    <div class="d-flex align-items-center" :style="{ paddingLeft: row.depth * 1.5 + 'rem' }">
                      <FaIcon v-if="row.depth > 0" icon="level-up-alt" class="text-muted me-2 fa-rotate-90" style="font-size: 0.75rem;" />
                      <input class="form-control form-control-sm" v-model="row.cat.name" :disabled="isDefaultCategory(row.cat, row.depth) || readOnly" />
                    </div>
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <FaIcon :icon="row.cat.icon || 'question'" class="text-muted" />
                      <select class="form-select form-select-sm" v-model="row.cat.icon" :disabled="isDefaultCategory(row.cat, row.depth) || readOnly">
                        <!-- a hand-written icon that is not in the list would show as nothing
                             selected, as if the category had no icon at all : offer it as an
                             option so it stays visible and is not replaced unnoticed -->
                        <option v-if="row.cat.icon && !availableIcons.includes(row.cat.icon)" :value="row.cat.icon">{{ row.cat.icon }}</option>
                        <option v-for="ic in availableIcons" :key="ic" :value="ic">{{ ic }}</option>
                      </select>
                    </div>
                  </td>
                  <td class="text-center">
                    <div v-if="!isDefaultCategory(row.cat, row.depth) && !readOnly" class="d-flex justify-content-center gap-1">
                      <button class="btn btn-sm btn-outline-secondary" @click="addSubcategory(row.cat)" :title="t('settings.settingsPage.addSubcategory')">
                        <FaIcon icon="plus" />
                      </button>
                      <button class="btn btn-sm btn-outline-danger" @click="removeCategory(row.cat)">
                        <FaIcon icon="trash" />
                      </button>
                    </div>
                    <span v-else-if="isDefaultCategory(row.cat, row.depth)" class="badge bg-secondary-subtle text-muted">{{ t('settings.settingsPage.requiredItem') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="d-flex justify-content-end mt-3">
              <BsButton icon="plus" colorClass="secondary" :disabled="readOnly" @click="addCategory()">{{ t('settings.settingsPage.addCategory') }}</BsButton>
            </div>
          </div>
        </template>
        <template #actions>
          <BsButton icon="save" :colorClass="isCategoriesDirty ? 'primary' : 'secondary'" :disabled="!isCategoriesDirty || readOnly" @click="saveCategories()">{{ t('settings.common.save') }}</BsButton>
        </template>
      </AppSettings>
    </main>
  </div>
</template>
