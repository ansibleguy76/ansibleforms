<script setup>
/******************************************************************/
/*                                                                */
/*  A form's Visual tab in the designer, on the same YAML as its  */
/*  YAML tab (saved with the designer's Save) :                   */
/*    Form : every setting of the form settings, edited in place, */
/*      only those its type allows (the schema refuses others).   */
/*    Fields : an outline, as the categories' : a field's name,   */
/*      type, label and required in its row, ↑ ↓ to move it,      */
/*      Delete, the toolbar's + to add one ; its row unfolds its  */
/*      help, default, output and values.                         */
/*                                                                */
/*  Every edit changes only the keys it touches, in the YAML      */
/*  document itself (lib/formDoc.js) : comments, quoting, the     */
/*  jobs and whatever else the form holds stay as written. What   */
/*  cannot be rewritten safely (an alias) is shown, not edited.   */
/*                                                                */
/*  @props:                                                       */
/*      modelValue: String - the form's YAML                      */
/*      readOnly: Boolean - shown, not editable                   */
/*      categoryOptions: String[] - the categories' paths         */
/*      roleOptions: String[] - the roles' names                  */
/*  @emits:                                                       */
/*      update:modelValue - the YAML, edited                      */
/*                                                                */
/******************************************************************/
import { ref, shallowRef, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import YAML from 'yaml';
import { fieldTypes, formTypes, forbiddenFormKeys, fieldTypeAllows } from '@/config/formFields';
import { availableIcons } from '@/config/icons';
import {
  fieldsState,
  readFields,
  setFieldText,
  setFieldRequired,
  setFieldType,
  moveField,
  removeField,
  addField,
  setFormText,
  setFormType,
  formList,
  setFormList,
  setFormValue,
  fieldDefaultText,
  setFieldDefault,
  setFieldOutput,
  fieldValuesText,
  setFieldValues,
} from '@/lib/formDoc';

const props = defineProps({
  modelValue: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
  categoryOptions: { type: Array, default: () => [] },
  roleOptions: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);
const { t } = useI18n();

// ─── the YAML as a document ───────────────────────────────────────────────────
// a shallow ref : the yaml library's nodes are not made reactive ; rev says they changed
const doc = shallowRef(null);
const rev = ref(0);
const error = ref('');
// the text last written : our own edit coming back from the parent is not read again
let lastText = null;

/**
 * Reads the form's YAML into a document ; an error leaves nothing to edit.
 *
 * Args:
 *   text (string): the YAML.
 */
function read(text) {
  lastText = text;
  try {
    const parsed = YAML.parseDocument(text || '');
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);
    if (!YAML.isMap(parsed.contents)) throw new Error(t('designer.visualNotAMap'));
    doc.value = parsed;
    error.value = '';
  } catch (e) {
    doc.value = null;
    error.value = e?.message || String(e);
  }
  rev.value++;
}
watch(
  () => props.modelValue,
  (text) => {
    if (text !== lastText) read(text);
  },
  { immediate: true },
);

/**
 * Applies an edit to the document, then writes it back as the form's YAML.
 *
 * Args:
 *   edit (Function): doc => what it returns.
 *
 * Returns:
 *   any: what the edit returned ; nothing when the tab cannot edit.
 */
function change(edit) {
  if (locked.value || !doc.value) return undefined;
  const result = edit(doc.value);
  lastText = doc.value.toString();
  rev.value++;
  emit('update:modelValue', lastText);
  return result;
}

const locked = computed(() => props.readOnly || !!error.value);

// ─── Form : edited in place ───────────────────────────────────────────────────
const form = computed(() => {
  rev.value;
  if (!doc.value) return null;
  const d = doc.value;
  const str = (key) => {
    const v = d.get(key);
    return v === undefined || v === null ? '' : String(v);
  };
  const type = str('type') || 'ansible';
  return {
    name: str('name'),
    type,
    description: str('description'),
    playbook: str('playbook'),
    template: str('template'),
    icon: str('icon'),
    categories: formList(d, 'categories'),
    roles: formList(d, 'roles'),
  };
});
// what a type allows, as the schema : a subform has no categories, roles or icon ; what runs is
// a playbook (ansible) or an AWX template (awx), a multistep's steps are in the YAML
const isSubform = computed(() => form.value?.type === 'subform');

/**
 * Sets a text of the form (name, description, playbook, template, icon).
 *
 * Args:
 *   key (string): the key.
 *   value (string): the text.
 */
function setText(key, value) {
  change((d) => setFormText(d, key, value));
}

/**
 * Changes the form's type, telling which keys the new type made it drop.
 *
 * Args:
 *   type (string): the new type.
 */
function setType(type) {
  const removed = change((d) => setFormType(d, type));
  if (removed?.length) toast.warning(t('designer.typeKeysRemoved', { type, keys: removed.join(', ') }));
}

/**
 * Adds a category or a role to the form.
 *
 * Args:
 *   key (string): 'categories' or 'roles'.
 *   value (string): the category's path, the role's name.
 */
function addTo(key, value) {
  const list = form.value?.[key];
  if (!value || !list || list.includes(value)) return;
  change((d) => setFormList(d, key, [...list, value]));
}

/**
 * Removes a category or a role from the form.
 *
 * Args:
 *   key (string): 'categories' or 'roles'.
 *   value (string): the category's path, the role's name.
 */
function removeFrom(key, value) {
  const list = form.value?.[key];
  if (!list) return;
  change((d) =>
    setFormList(
      d,
      key,
      list.filter((x) => x !== value),
    ),
  );
}

// ─── the rest of the settings : as the form settings show them, what the type allows ────────
/**
 * Whether the form's type allows a key (the schema refuses the form with a forbidden one).
 *
 * Args:
 *   key (string): the key.
 *
 * Returns:
 *   boolean: true when it does.
 */
function allows(key) {
  return !(forbiddenFormKeys[form.value?.type] || []).includes(key);
}
const awx = computed(() => form.value?.type === 'awx');
const runs = computed(() => ['ansible', 'awx'].includes(form.value?.type));
// the text settings : the key, its label, its icon, when it shows, its help
const textSettings = computed(() =>
  [
    {
      key: 'inventory',
      label: 'designer.formInventory',
      icon: 'list',
      show: allows('inventory'),
      help: 'designer.helpInventory',
    },
    {
      key: 'scm_branch',
      label: 'designer.formScmBranch',
      icon: 'code-branch',
      show: awx.value,
      help: 'designer.helpScmBranch',
    },
    {
      key: 'executionEnvironment',
      label: 'designer.formExecEnv',
      icon: 'cube',
      show: awx.value,
      help: 'designer.helpExecEnv',
    },
    {
      key: 'ansibleCredentials',
      label: 'designer.formAnsibleCreds',
      icon: 'key',
      show: allows('ansibleCredentials'),
      help: 'designer.helpAnsibleCreds',
    },
    {
      key: 'vaultCredentials',
      label: 'designer.formVaultCreds',
      icon: 'lock',
      show: allows('vaultCredentials'),
      help: 'designer.helpVaultCreds',
    },
    { key: 'tags', label: 'designer.formTags', icon: 'tags', show: allows('tags'), help: 'designer.helpTags' },
    { key: 'limit', label: 'designer.formLimit', icon: 'filter', show: allows('limit'), help: 'designer.helpLimit' },
  ].filter((x) => x.show),
);
// ─── the user in the extravars : the instance's default, all, none, or only some keys ───
// (server/src/lib/common.js, userForExtravars) ; empty follows EXTRAVARS_USER_FIELDS
const userKeysChosen = ref(false);
const userMode = computed(() => {
  const v = String(setting('userExtravars') || '').trim();
  if (!v) return userKeysChosen.value ? 'keys' : '';
  if (v.toLowerCase() === 'all') return 'all';
  if (v.toLowerCase() === 'none') return 'none';
  return 'keys';
});

/**
 * Picks what the playbook gets of the user : the keys are typed next, nothing is written until
 * then (empty would mean the instance's default).
 *
 * Args:
 *   mode (string): '', 'all', 'none' or 'keys'.
 */
function setUserMode(mode) {
  userKeysChosen.value = mode === 'keys';
  if (mode === 'keys') {
    // keys already there stay ; 'all' or 'none' make room for the keys to type
    if (['all', 'none'].includes(String(setting('userExtravars')).toLowerCase())) setText('userExtravars', '');
    return;
  }
  setText('userExtravars', mode);
}

// ─── the runner : one of the instance's, of the type the form needs ───────────
// (an ansible form's jobs run on an rte, an awx form's on an awx : server/src/lib/formLinks.js) ;
// the list needs the settings' permission : without it, the name is typed
const runners = ref(null);
onMounted(async () => {
  try {
    const res = await axios.get('/api/v2/runner/');
    runners.value = (res.data?.records || res.data || [])
      .filter((r) => r && r.name)
      .map((r) => ({ name: String(r.name), type: String(r.type || '') }));
  } catch {
    runners.value = null;
  }
});
const runnerChoices = computed(() => {
  if (!runners.value) return null;
  const need = form.value?.type === 'awx' ? 'awx' : 'rte';
  return runners.value.filter((r) => r.type === need).map((r) => r.name);
});

// the switches : true, or no key
const flagSettings = computed(() =>
  [
    { key: 'showHelp', label: 'designer.showHelpByDefault', show: true },
    { key: 'check', label: 'designer.formCheck', show: allows('check') },
    { key: 'diff', label: 'designer.formDiff', show: allows('diff') },
    { key: 'allowRelaunch', label: 'designer.formAllowRelaunch', show: allows('allowRelaunch') },
    { key: 'abortable', label: 'designer.formAbortable', show: allows('abortable') },
    // a wizard's fields live in its steps : not offered in the chat
    { key: 'enableForChat', label: 'designer.formChat', show: allows('enableForChat') && !hasWizard.value },
    { key: 'verbose', label: 'designer.formVerbose', show: allows('verbose') },
    { key: 'keepExtravars', label: 'designer.formKeepExtravars', show: allows('keepExtravars') },
  ].filter((x) => x.show),
);
const hasWizard = computed(() => {
  rev.value;
  const w = doc.value?.get('wizard');
  return !!w && (YAML.isSeq(w) ? w.items.length > 0 : true);
});

/**
 * A setting as the page shows it : its text, '' without.
 *
 * Args:
 *   key (string): the key.
 *
 * Returns:
 *   any: the value.
 */
function setting(key) {
  rev.value;
  const v = doc.value?.get(key);
  if (v === undefined || v === null) return '';
  return YAML.isNode(v) ? v.toJSON() : v;
}

/**
 * Sets a flag of the form : true, or no key.
 *
 * Args:
 *   key (string): the key.
 *   on (boolean): on or off.
 */
function setFlag(key, on) {
  change((d) => setFormValue(d, key, on ? true : undefined));
}

/**
 * Sets the form's order : a number, or no key.
 *
 * Args:
 *   text (string): what was typed.
 */
function setOrder(text) {
  const n = Number(text);
  change((d) => setFormValue(d, 'order', text !== '' && !isNaN(n) ? n : undefined));
}

/**
 * Sets the AWX instance groups from a list typed with commas.
 *
 * Args:
 *   text (string): the groups, comma separated.
 */
function setInstanceGroups(text) {
  const list = String(text)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  change((d) => setFormValue(d, 'instanceGroups', list.length ? list : undefined));
}

// what each list may still add : the categories' paths and the roles' names not in it yet
const categoryChoices = computed(() => props.categoryOptions.filter((c) => !form.value?.categories?.includes(c)));
const roleChoices = computed(() => props.roleOptions.filter((r) => !form.value?.roles?.includes(r)));

// ─── Fields : an outline ──────────────────────────────────────────────────────
// a field's row keeps its identity across edits (its node) : the inputs keep their focus
const uids = new WeakMap();
let nextUid = 0;
const uidOf = (node) => {
  if (!uids.has(node)) uids.set(node, ++nextUid);
  return uids.get(node);
};

const fieldsMode = computed(() => {
  rev.value;
  return fieldsState(doc.value);
});
const fields = computed(() => {
  rev.value;
  return readFields(doc.value).map((f) => ({ ...f, uid: uidOf(f.node) }));
});
const fieldsEditable = computed(() => !locked.value && ['list', 'none'].includes(fieldsMode.value));

/**
 * Changes a field's type, telling what the new type made it drop and what it lacks.
 *
 * Args:
 *   row (object): the field's row.
 *   type (string): the new type.
 */
function setRowType(row, type) {
  const result = change(() => setFieldType(row.node, type));
  if (!result) return;
  const name = row.name || '?';
  if (result.removed.length)
    toast.warning(t('designer.fieldKeysRemoved', { details: `${name}: ${result.removed.join(', ')}` }));
  if (result.needs)
    toast.warning(
      t('designer.fieldKeysMissing', {
        details: `${name} (${type}): ${result.needs.map((s) => s.join(' + ')).join(' | ')}`,
      }),
    );
}

// the fields unfolded (their help, default, output, values), by their row's identity
const open = ref(new Set());
const toggle = (uid) => {
  const next = new Set(open.value);
  if (next.has(uid)) next.delete(uid);
  else next.add(uid);
  open.value = next;
};
// a values text that is not a list : said under it, not written
const valuesError = ref({});

/**
 * Sets a field's values from the YAML typed : refused (said) when not a list.
 *
 * Args:
 *   row (object): the field's row.
 *   text (string): the YAML.
 */
function setRowValues(row, text) {
  let problem = '';
  change((d) => {
    problem = setFieldValues(d, row.node, text);
  });
  valuesError.value = { ...valuesError.value, [row.uid]: problem };
}

/**
 * Removes a field, after asking : its other properties go with it.
 *
 * Args:
 *   row (object): the field's row.
 *   index (number): its position.
 */
function removeRow(row, index) {
  if (!confirm(`${t('settings.common.deleteConfirm')} ${row.name || '?'}?`)) return;
  change((d) => removeField(d, index));
}

// the designer's toolbar adds a field (its + button)
defineExpose({
  add: () => fieldsEditable.value && change((d) => addField(d)),
  locked: computed(() => !fieldsEditable.value),
});
</script>
<template>
  <div class="af-visual-editor af-form-visual">
    <div v-if="error" class="alert alert-danger py-2 mb-3" role="alert">
      <FaIcon icon="triangle-exclamation" class="me-2" />{{ t('designer.visualYamlError') }} : {{ error }}
    </div>
    <template v-else-if="form">
      <!-- ─── Form : edited in place ─── -->
      <div class="af-form-grid">
        <div>
          <label class="form-label fw-bold">{{ t('designer.formName') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="font" /></span>
            <input
              class="form-control"
              :class="{ 'is-invalid': !form.name.trim() }"
              :value="form.name"
              :disabled="locked"
              @change="setText('name', $event.target.value)"
            />
          </div>
        </div>
        <div>
          <label class="form-label fw-bold">{{ t('designer.formType') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="shapes" /></span>
            <select class="form-select" :value="form.type" :disabled="locked" @change="setType($event.target.value)">
              <option v-if="!formTypes.includes(form.type)" :value="form.type">{{ form.type }}</option>
              <option v-for="ft in formTypes" :key="ft" :value="ft">{{ ft }}</option>
            </select>
          </div>
        </div>
        <div v-if="!isSubform">
          <label class="form-label fw-bold">{{ t('designer.visualIcon') }}</label>
          <div class="input-group">
            <span class="input-group-text"
              ><FaIcon :fixedwidth="true" :icon="form.icon || 'square'" :class="{ 'opacity-25': !form.icon }"
            /></span>
            <select
              class="form-select"
              :value="form.icon"
              :disabled="locked"
              @change="setText('icon', $event.target.value)"
            >
              <option value="">{{ t('designer.visualNoIcon') }}</option>
              <option v-if="form.icon && !availableIcons.includes(form.icon)" :value="form.icon">
                {{ form.icon }}
              </option>
              <option v-for="ic in availableIcons" :key="ic" :value="ic">{{ ic }}</option>
            </select>
          </div>
        </div>
        <div class="af-form-wide">
          <label class="form-label fw-bold">{{ t('designer.formDescription') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="align-left" /></span>
            <input
              class="form-control"
              :value="form.description"
              :disabled="locked"
              @change="setText('description', $event.target.value)"
            />
          </div>
        </div>
        <div class="af-form-wide">
          <label class="form-label fw-bold">{{ t('designer.helpText') }}</label>
          <textarea
            class="form-control"
            rows="3"
            :value="setting('help')"
            :disabled="locked"
            @change="setText('help', $event.target.value)"
          ></textarea>
        </div>
        <!-- its categories and roles : what it has, as pills to remove, and a list to add from -->
        <div v-for="key in isSubform ? [] : ['categories', 'roles']" :key="key" class="af-form-wide">
          <label class="form-label fw-bold">{{
            key === 'categories' ? t('designer.visualCategories') : t('designer.visualRoles')
          }}</label>
          <div v-if="form[key] === null" class="text-body-secondary fst-italic">{{ t('designer.visualInYaml') }}</div>
          <div v-else class="d-flex align-items-center flex-wrap gap-2">
            <span v-for="v in form[key]" :key="v" class="badge rounded-pill af-form-pill">
              {{ v }}
              <button
                type="button"
                class="btn-close ms-1"
                :disabled="locked"
                :aria-label="t('common.delete')"
                @click="removeFrom(key, v)"
              ></button>
            </span>
            <span v-if="!form[key].length && key === 'categories'" class="text-body-secondary">Default</span>
            <select
              class="form-select form-select-sm af-form-add"
              :disabled="locked || !(key === 'categories' ? categoryChoices : roleChoices).length"
              :value="''"
              @change="
                addTo(key, $event.target.value);
                $event.target.value = '';
              "
            >
              <option value="">{{ t('designer.visualAdd') }}</option>
              <option v-for="o in key === 'categories' ? categoryChoices : roleChoices" :key="o" :value="o">
                {{ o }}
              </option>
            </select>
          </div>
        </div>
        <!-- the rest of the settings : the texts, then AWX's instance groups, the order, the launch
             validation, the help, the switches - only what the type allows -->
        <div v-if="form.type === 'ansible'">
          <label class="form-label fw-bold">{{ t('designer.formPlaybook') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="file-code" /></span>
            <input
              class="form-control"
              :class="{ 'is-invalid': !form.playbook.trim() }"
              :value="form.playbook"
              :disabled="locked"
              spellcheck="false"
              @change="setText('playbook', $event.target.value)"
            />
          </div>
          <div class="form-text">{{ t('designer.helpPlaybook') }}</div>
        </div>
        <div v-if="form.type === 'awx'">
          <label class="form-label fw-bold">{{ t('designer.formTemplate') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="file-code" /></span>
            <input
              class="form-control"
              :class="{ 'is-invalid': !form.template.trim() }"
              :value="form.template"
              :disabled="locked"
              @change="setText('template', $event.target.value)"
            />
          </div>
          <div class="form-text">{{ t('designer.helpTemplate') }}</div>
        </div>
        <!-- the runner : picked from the instance's, of the type the form needs ; typed when the
             list cannot be read -->
        <div v-if="runs">
          <label class="form-label fw-bold">{{ t('designer.formRunner') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="server" /></span>
            <select
              v-if="runnerChoices"
              class="form-select"
              :value="setting('runner')"
              :disabled="locked"
              @change="setText('runner', $event.target.value)"
            >
              <option value="">{{ t('designer.runnerDefault') }}</option>
              <!-- a runner the list does not have (another type, or gone) : offered, so it shows -->
              <option v-if="setting('runner') && !runnerChoices.includes(setting('runner'))" :value="setting('runner')">
                {{ setting('runner') }}
              </option>
              <option v-for="r in runnerChoices" :key="r" :value="r">{{ r }}</option>
            </select>
            <input
              v-else
              class="form-control"
              :value="setting('runner')"
              :disabled="locked"
              spellcheck="false"
              @change="setText('runner', $event.target.value)"
            />
          </div>
          <div class="form-text">{{ t('designer.formRunnerHelp') }}</div>
        </div>
        <div v-for="x in textSettings" :key="x.key">
          <label class="form-label fw-bold">{{ t(x.label) }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" :icon="x.icon" /></span>
            <input
              class="form-control"
              :value="setting(x.key)"
              :disabled="locked"
              spellcheck="false"
              @change="setText(x.key, $event.target.value)"
            />
          </div>
          <div v-if="x.help" class="form-text">{{ t(x.help) }}</div>
        </div>
        <!-- the user in the extravars : a choice, and the keys when only some -->
        <div v-if="allows('userExtravars')">
          <label class="form-label fw-bold">{{ t('designer.formUserExtravars') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="user" /></span>
            <select class="form-select" :value="userMode" :disabled="locked" @change="setUserMode($event.target.value)">
              <option value="">{{ t('designer.userExtravarsDefault') }}</option>
              <option value="all">{{ t('designer.userExtravarsAll') }}</option>
              <option value="none">{{ t('designer.userExtravarsNone') }}</option>
              <option value="keys">{{ t('designer.userExtravarsKeys') }}</option>
            </select>
          </div>
          <div v-if="userMode === 'keys'" class="input-group mt-2">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="key" /></span>
            <input
              class="form-control"
              :value="userMode === 'keys' ? setting('userExtravars') : ''"
              :disabled="locked"
              placeholder="username,email,type"
              spellcheck="false"
              @change="
                setText(
                  'userExtravars',
                  $event.target.value
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .join(','),
                )
              "
            />
          </div>
          <div class="form-text">{{ t('designer.formUserExtravarsHelp') }}</div>
        </div>
        <div v-if="awx">
          <label class="form-label fw-bold">{{ t('designer.formInstanceGroups') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="layer-group" /></span>
            <input
              class="form-control"
              :value="
                Array.isArray(setting('instanceGroups'))
                  ? setting('instanceGroups').join(', ')
                  : setting('instanceGroups')
              "
              :disabled="locked"
              @change="setInstanceGroups($event.target.value)"
            />
          </div>
          <div class="form-text">{{ t('designer.helpInstanceGroups') }}</div>
        </div>
        <div v-if="allows('order')">
          <label class="form-label fw-bold">{{ t('designer.formOrder') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="arrow-down-1-9" /></span>
            <input
              type="number"
              class="form-control"
              :value="setting('order')"
              :disabled="locked"
              @change="setOrder($event.target.value)"
            />
          </div>
          <div class="form-text">{{ t('designer.helpOrder') }}</div>
        </div>
        <div v-if="allows('launchValidation')">
          <label class="form-label fw-bold">{{ t('designer.formLaunchValidation') }}</label>
          <div class="input-group">
            <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="shield-halved" /></span>
            <select
              class="form-select"
              :value="setting('launchValidation')"
              :disabled="locked"
              @change="setText('launchValidation', $event.target.value)"
            >
              <option value="">{{ t('designer.formLaunchValidationDefault') }}</option>
              <option value="log">log</option>
              <option value="enforce">enforce</option>
            </select>
          </div>
          <div class="form-text">{{ t('designer.formLaunchValidationHelp') }}</div>
        </div>
        <!-- the switches, under a title of their own as every field has -->
        <label class="form-label fw-bold af-form-wide mb-0">{{ t('designer.visualOptions') }}</label>
        <div class="af-form-wide af-form-flags">
          <div v-for="x in flagSettings" :key="x.key" class="form-check form-switch">
            <input
              :id="'af-flag-' + x.key"
              class="form-check-input"
              type="checkbox"
              role="switch"
              :checked="setting(x.key) === true"
              :disabled="locked"
              @change="setFlag(x.key, $event.target.checked)"
            />
            <label class="form-check-label" :for="'af-flag-' + x.key">{{ t(x.label) }}</label>
          </div>
        </div>
      </div>

      <!-- ─── Fields : an outline ─── -->
      <h6 class="fw-bold mt-4 mb-2">{{ t('designer.visualFields') }}</h6>
      <!-- what is edited here, and where the rest is -->
      <p class="form-text mt-0 mb-2">{{ t('designer.visualFieldsHint') }}</p>
      <div v-if="fieldsMode === 'alias' || fieldsMode === 'unreadable'" class="alert alert-info py-2" role="alert">
        <FaIcon icon="circle-info" class="me-2" />{{ t('designer.visualFieldsInYaml') }}
      </div>
      <div v-else-if="!fields.length" class="empty-state">
        <FaIcon icon="list" class="empty-state-icon" />
        <span>{{ t('designer.visualNoFields') }}</span>
      </div>
      <div v-else class="af-cats">
        <div class="af-cats-row af-cats-head">
          <span></span>
          <span>{{ t('designer.fieldName') }}</span>
          <span>{{ t('designer.fieldType') }}</span>
          <span>{{ t('designer.fieldLabel') }}</span>
          <span class="text-center">{{ t('designer.visualRequired') }}</span>
          <span></span>
        </div>
        <template v-for="(f, i) in fields" :key="f.uid">
          <div class="af-cats-row">
            <!-- its other properties : unfolded under it -->
            <button
              type="button"
              class="btn btn-link px-1 af-field-caret"
              :aria-expanded="open.has(f.uid)"
              :title="t('designer.visualFieldDetails')"
              @click="toggle(f.uid)"
            >
              <FaIcon icon="caret-right" :class="{ 'fa-rotate-90': open.has(f.uid) }" />
            </button>
            <div class="input-group">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="i-cursor" /></span>
              <input
                class="form-control"
                :class="{ 'is-invalid': f.noName || f.duplicate }"
                :value="f.name"
                :disabled="!fieldsEditable"
                :title="f.duplicate ? t('designer.visualDuplicateField') : f.noName ? t('designer.visualNoName') : ''"
                :aria-label="t('designer.fieldName')"
                spellcheck="false"
                @change="change(() => setFieldText(f.node, 'name', $event.target.value.trim()))"
              />
            </div>
            <div class="input-group">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="shapes" /></span>
              <select
                class="form-select"
                :value="f.type"
                :disabled="!fieldsEditable"
                :aria-label="t('designer.fieldType')"
                @change="setRowType(f, $event.target.value)"
              >
                <!-- a type not in the list (a typo in the YAML) : offered, so it stays visible -->
                <option v-if="!fieldTypes.includes(f.type)" :value="f.type">{{ f.type }}</option>
                <option v-for="ft in fieldTypes" :key="ft" :value="ft">{{ ft }}</option>
              </select>
            </div>
            <div class="input-group">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="font" /></span>
              <input
                class="form-control"
                :value="f.label"
                :disabled="!fieldsEditable"
                :aria-label="t('designer.fieldLabel')"
                @change="change(() => setFieldText(f.node, 'label', $event.target.value))"
              />
            </div>
            <div class="form-check form-switch d-flex justify-content-center mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="f.required"
                :disabled="!fieldsEditable"
                :aria-label="t('designer.visualRequired')"
                @change="change(() => setFieldRequired(f.node, $event.target.checked))"
              />
            </div>
            <div class="d-flex gap-2 justify-content-end">
              <div class="btn-group" role="group" :aria-label="t('settings.interface.linkMoves')">
                <button
                  type="button"
                  class="btn af-row-btn"
                  :class="fieldsEditable && i > 0 ? 'btn-outline-primary' : 'btn-outline-secondary'"
                  :disabled="!fieldsEditable || i === 0"
                  :title="t('settings.settingsPage.moveUp')"
                  @click="change((d) => moveField(d, i, -1))"
                >
                  <FaIcon icon="arrow-up" />
                </button>
                <button
                  type="button"
                  class="btn af-row-btn"
                  :class="fieldsEditable && i < fields.length - 1 ? 'btn-outline-primary' : 'btn-outline-secondary'"
                  :disabled="!fieldsEditable || i === fields.length - 1"
                  :title="t('settings.settingsPage.moveDown')"
                  @click="change((d) => moveField(d, i, 1))"
                >
                  <FaIcon icon="arrow-down" />
                </button>
              </div>
              <button
                type="button"
                class="btn af-row-btn"
                :class="fieldsEditable ? 'btn-outline-danger' : 'btn-outline-secondary'"
                :disabled="!fieldsEditable"
                :title="t('common.delete')"
                @click="removeRow(f, i)"
              >
                <FaIcon icon="trash" />
              </button>
            </div>
          </div>
          <!-- the field's other properties : help, default, output, values (when its type has them) -->
          <div v-if="open.has(f.uid)" class="af-field-details">
            <div>
              <label class="form-label fw-bold">{{ t('designer.fieldHelp') }}</label>
              <input
                class="form-control"
                :value="String(f.node.get('help') ?? '')"
                :disabled="!fieldsEditable"
                @change="change(() => setFieldText(f.node, 'help', $event.target.value))"
              />
            </div>
            <div>
              <label class="form-label fw-bold">{{ t('designer.fieldDefault') }}</label>
              <input
                v-if="fieldDefaultText(f.node) !== null"
                class="form-control"
                :value="fieldDefaultText(f.node)"
                :disabled="!fieldsEditable"
                spellcheck="false"
                @change="change(() => setFieldDefault(f.node, $event.target.value))"
              />
              <div v-else class="text-body-secondary fst-italic">{{ t('designer.visualInYaml') }}</div>
            </div>
            <div class="form-check form-switch align-self-end mb-2">
              <input
                :id="'af-out-' + f.uid"
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="f.node.get('output') !== false"
                :disabled="!fieldsEditable"
                @change="change(() => setFieldOutput(f.node, $event.target.checked))"
              />
              <label class="form-check-label" :for="'af-out-' + f.uid">{{ t('designer.fieldOutput') }}</label>
            </div>
            <div v-if="fieldTypeAllows(f.type, 'values')" class="af-field-values">
              <label class="form-label fw-bold">{{ t('designer.fieldValues') }}</label>
              <textarea
                v-if="fieldValuesText(f.node) !== null"
                class="form-control font-monospace"
                :class="{ 'is-invalid': valuesError[f.uid] }"
                rows="4"
                :value="fieldValuesText(f.node)"
                :disabled="!fieldsEditable"
                spellcheck="false"
                placeholder="- dev
- prod"
                @change="setRowValues(f, $event.target.value)"
              ></textarea>
              <div v-else class="text-body-secondary fst-italic">{{ t('designer.visualInYaml') }}</div>
              <div v-if="valuesError[f.uid]" class="invalid-feedback d-block">{{ valuesError[f.uid] }}</div>
              <div class="form-text">{{ t('designer.visualValuesHelp') }}</div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
<style scoped lang="scss">
/* the form's fields : three short ones per line, sharing the pane's width ; a wide one
   (description, help, lists, options) on a line of its own */
.af-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem 1.5rem;
}
.af-form-wide {
  grid-column: 1 / -1;
}
/* a category or a role it has : a pill, its cross removes it */
.af-form-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.35em 0.6em;
  font-weight: 500;
  color: var(--bs-body-color);
  background-color: var(--bs-tertiary-bg);
  border: 1px solid var(--af-field-border);
  .btn-close {
    font-size: 0.55rem;
  }
}
/* the list to add from : as small as the pills beside it */
.af-form-add {
  width: auto;
  min-width: 10rem;
}
/* the fields : one row each, the same columns for the header line, as the categories' ; a pane
   narrower than them scrolls sideways rather than squeezing the fields */
.af-cats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}
.af-cats-row {
  display: grid;
  /* name and label share the room ; the last as wide as its buttons (two moves, the gap, Delete) */
  grid-template-columns: 1.75rem minmax(10rem, 1fr) 11rem minmax(10rem, 1fr) 6.5rem 8rem;
  gap: 0.75rem;
  align-items: center;
  min-width: 52rem;
}
.af-cats-head {
  font-weight: 700;
}
/* a field's caret : its other properties folded or not */
.af-field-caret {
  color: var(--bs-secondary-color);
  text-decoration: none;
}
/* a field's other properties : under its row, past its caret, framed as a sub-part of it */
.af-field-details {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(12rem, 1fr) auto;
  gap: 0.75rem 1rem;
  margin: 0 0 0.5rem 2.5rem;
  padding: 0.75rem 1rem;
  border-left: 2px solid var(--af-field-border);
}
.af-field-values {
  grid-column: 1 / -1;
}
/* the form's switches : side by side, wrapping */
.af-form-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
}
</style>
