<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import Form from "@/lib/Form";
import Lock from "@/lib/Lock";
import Backup from "@/lib/Backup";
import Profile from "@/lib/Profile";
import YAML from "yaml";
import { toast } from "vue-sonner";
import { useRoute, useRouter } from "vue-router";
import Helpers from "@/lib/Helpers";
import axios from "axios";
import TokenStorage from "@/lib/TokenStorage";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { t } = useI18n();

const categories = ref("");
const roles = ref("");
const constants = ref("");
const forms = ref({});
const loaded = ref(false);
const currentForm = ref(null);
const tabs = ["Categories", "Roles", "Constants", "Forms"];
const currentTab = ref("Forms");
const showWarnings = ref(false);
const action = ref(null);
const lock = ref(false);
const lockError = ref('');
const nextAction = ref(false);
const lockInterval = ref(null);
const backups = ref([]);
const backupToRestore = ref(null);
const backupBeforeRestore = ref(false);
const authenticated = ref(false);


const route = useRoute();
const router = useRouter();

const isValid = computed(() => {
  return warnings.value.length == 0;
});

// change detection : the designer is "dirty" when the parsed content differs
// from the last saved/loaded baseline. Comparing the PARSED content (not the
// raw text) is robust to whitespace/newline noise from the editor and matches
// what a save persists, so reverting an edit (eg type a char then erase it)
// clears the dirty state. The ace editor live-syncs its v-model on every edit,
// so this computed re-evaluates as you type.
const dirtyBaseline = ref(null);
function contentSnapshot() {
  return JSON.stringify({ c: categoriesObj.value, r: rolesObj.value, k: constantsObj.value, f: formsObj.value });
}
function setDirtyBaseline() {
  dirtyBaseline.value = contentSnapshot();
}
const isDirty = computed(() => dirtyBaseline.value !== null && contentSnapshot() !== dirtyBaseline.value);

const formTemplate = {
  name: "New Form",
  type: "ansible",
  playbook: "dummy.yaml",
  description: "",
  roles: ["public"],
  categories: [],
  tileClass: "has-background-info-light",
  icon: "bullseye",
  fields: [
    {
      name: "field1",
      type: "text",
      label: "field1",
    },
  ],
};

// computed values

const files = computed(() => {
  return formsObj.value
    .map((x) => x.source)
    .filter((v, i, a) => a.indexOf(v) === i);
});

const formsObj = computed(() => {
  return Object.keys(forms.value).map((x) => {
    try {
      var result = YAML.parse(forms.value[x]);
      if (result.name) {
        return result;
      } else {
        throw new Error("parsing issue");
      }
    } catch {
      return { name: x, source: "Parsing issues" };
    }
  });
});

const categoriesObj = computed(() => {
  if (!categories.value) {
    return [{ name: "Default", icon: "bars" }];
  }
  try {
    var result = YAML.parse(categories.value);
    if (
      Array.isArray(result) &&
      result.length > 0 &&
      result[0].name &&
      result[0].icon
    ) {
      return result;
    } else {
      throw new Error("parsing issue");
    }
  } catch {
    return undefined;
  }
});

const rolesObj = computed(() => {
  if (!roles.value) {
    return [
      { name: "admin", groups: ["local/admins"] },
      { name: "public", groups: [] },
    ];
  }
  try {
    var result = YAML.parse(roles.value);
    if (
      Array.isArray(result) &&
      result.length > 0 &&
      result[0].name &&
      result[0].groups
    ) {
      return result;
    } else {
      throw new Error("parsing issue");
    }
  } catch {
    return undefined;
  }
});

const constantsObj = computed(() => {
  if (!constants.value) {
    return {};
  }
  try {
    var result = YAML.parse(constants.value);
    return result;
  } catch {
    return undefined;
  }
});

const idmapping = computed(() => {
  if (!forms.value) {
    return {};
  }
  return Object.keys(forms.value).map((x) => {
    try {
      var tmp = YAML.parse(forms.value[x]);
      if (tmp && tmp.name) {
        return { id: x, source: tmp.source, name: tmp.name };
      } else {
        throw new Error("A form must have a few basic properties, like 'name'");
      }
    } catch (err) {
      return { id: x, source: "Parsing issues", name: x, issue: err.message };
    }
  });
});

const currentFormName = computed(() => {
  return idmapping.value.find((x) => x.id == currentForm.value)?.name || null;
});

const lockAge = computed(() => {
  if (lock.value?.lock) {
    return dayjs(lock.value.lock.created).fromNow();
  } else {
    return "";
  }
});

const warnings = computed(() => {
  var warnings = [];
  var names = idmapping.value.map((x) => x.name);
  var dups = names.filter((item, index) => names.indexOf(item) !== index);
  var empties = idmapping.value.filter((item, index) => !item.name);
  var parsing = idmapping.value.filter(
    (item) => item.source == "Parsing issues"
  );
  var badsource = idmapping.value.filter(
    (item) =>
      item.source &&
      !item.source == "Parsing issues" &&
      (!(item.source.endsWith(".yaml") || item.source.endsWith(".yml")) ||
        item.source.includes("/"))
  );
  warnings = warnings.concat(
    dups.map(
      (x) =>
        `<span class="text-danger fw-bold">Form '${x}' has duplicates</span><br><span>Each form must have a unique name</span>`
    )
  );
  warnings = warnings.concat(
    empties.map(
      (x) =>
        `<span class="text-danger fw-bold">Empty Formname</span><br><span>Each form must have a unique name</span>`
    )
  );
  warnings = warnings.concat(
    parsing.map(
      (x) =>
        `<span class="text-danger fw-bold">Form '${x.name}' has bad YAML and cannot be parsed</span><br><span>${x.issue}</span>`
    )
  );
  warnings = warnings.concat(
    badsource.map(
      (x) =>
        `<span class="text-danger fw-bold">Form '${x.name}' has a bad 'source' property</span><br><span>A source should be valid a .yaml file.  No deep-paths are allowed.<br>Remove the source to keep it in the base file.</span>`
    )
  );
  if (!categoriesObj.value) {
    warnings.push(
      `<span class="text-danger fw-bold">Bad categories: </span><span>Unable to parse categories as valid YAML</span>`
    );
  }
  if (!rolesObj.value) {
    warnings.push(
      `<span class="text-danger fw-bold">Bad roles: </span><span>Unable to parse roles as valid YAML</span>`
    );
  }
  if (!constantsObj.value) {
    warnings.push(
      `<span class="text-danger fw-bold">Bad constants: </span><span>Unable to parse constants as valid YAML</span>`
    );
  }
  // check field dups
  (formsObj.value || []).forEach((item) => {
    var fields = [];
    if (item.fields) {
      item.fields.forEach((item2) => {
        fields.push(item2.name);
      });
      var dups = Helpers.findDuplicates(fields);
      dups.forEach((item2, i) => {
        warnings.push(
          `<span class="text-danger fw-bold">'${item2}' in form '${item.name}' has duplicates</span><br><span>Each field must have a unique name</span>`
        );
      });
    }
  });
  return warnings;
});

// methods

async function loadForms() {
  try {
    const formConfig = await Form.loadAll();
    categories.value = YAML.stringify(formConfig.categories);
    roles.value = YAML.stringify(formConfig.roles);
    if (formConfig.constants) {
      constants.value = YAML.stringify(formConfig.constants);
    }
    formConfig.forms.forEach((f, i) => {
      forms.value[`form_${i}`] = YAML.stringify(f);
    });
    selectDefaultForm();
    loaded.value = true;
    // the freshly loaded content is the clean baseline (only on success, so a
    // failed/partial load doesn't mark a blank designer as "clean" and saveable)
    setDirtyBaseline();
  } catch (err) {
    // a (re)load failed after the content was cleared : don't leave a blank
    // editor paired with a stale baseline (that reads as dirty and would let a
    // save overwrite the repo with empty content). Drop back to the not-loaded
    // state with no baseline, so the editor is hidden and Save stays disabled.
    loaded.value = false;
    dirtyBaseline.value = null;
    toast.error(err.message);
  }
}

async function loadLock() {
  try {
    lock.value = await Lock.get();
    lockError.value = '';
  } catch (err) {
    if (err?.response?.status === 403 && err?.response?.data?.error) {
      lockError.value = err.response.data.error;
    } else {
      toast.error(err.message);
    }
  }
}

async function loadBackups() {
  try {
    backups.value = await Backup.load();
  } catch (err) {
    toast.error(err.message);
  }
}

function selectDefaultForm() {
  currentForm.value = idmapping.value[0]?.id || null;
  if (route.query.form) {
    // find form in forms by name
    const f = idmapping.value.find((x) => x.name == route.query.form);
    if (f) {
      currentForm.value = f.id;
    }
  }
}

function isCurrentTab(name) {
  return currentTab.value == name;
}

function selectTab(name) {
  currentTab.value = name;
}

function isCurrentForm(id) {
  return currentForm.value == id;
}

function selectForm(id) {
  // select the form by id
  currentForm.value = id;
  // get the name and update the route
  if (currentFormName.value) {
    const query = { ...route.query };
    query.form = currentFormName.value;
    router.push({ query });
  }
}

function deleteForm(id) {
  selectForm(id);
  action.value = "delete";
}

function addForm(file) {
  // add a new form to the forms list
  // check if the form "New Form" already exists

  if (idmapping.value.find((x) => x.name == "New Form")) {
    toast.error(t('designer.newFormExists'));
    return false;
  }

  const id = `form_${Object.keys(forms.value).length}`;
  // don't mutate the shared formTemplate ; the spread + source below is enough
  forms.value[id] = YAML.stringify({ ...formTemplate, source: file });
  currentForm.value = id;
  // isDirty is computed from the content, adding a form makes it dirty
  return true;
}

function doDeleteForm() {
  // delete the form by id from forms list
  if (currentFormName.value) {
    delete forms.value[currentForm.value];
    // select default form
    selectDefaultForm();
  } else {
    toast.error("Cannot delete form with bad YAML");
  }
  action.value = null;
}

function restore() {
  action.value = "restore";
}

function assembleForms() {
  return YAML.stringify({
    categories: categoriesObj.value,
    roles: rolesObj.value,
    constants: constantsObj.value,
    forms: formsObj.value,
  });
}

function resetAction() {
  action.value = null;
  nextAction.value = false; // clear any pending callback so a later flow can't fire a stale one
}

async function setLock(proceed = true) {
  if (!proceed) {
    resetAction();
    return;
  }
  try {
    await Lock.set(true);
    await loadAll();
  } catch (err) {
    toast.error(err.message);
    lock.value = undefined;
  }
}

async function restoreBackup() {
  try {
    await Backup.restore(backupToRestore.value.file, backupBeforeRestore.value);
    toast.success(t('designer.backupRestored'));
    await loadAll();
    action.value = null;
  } catch (err) {
    toast.error(err.message);
  }
}

async function releaseLock() {
  try {
    // if dirty, we need to ask for confirmation, it means you are releasing the designer with unsaved changes
    if (isDirty.value) {
      action.value = "dirty";
      nextAction.value = async (proceed) => {
        resetAction();
        await deleteLock(proceed);
      };
      return;
    }
    // if not dirty, just release the lock
    await deleteLock();
  } catch (err) {
    toast.error(err.message);
    lock.value = undefined;
  }
}

async function deleteLock(proceed = true) {
  if (!proceed) {
    resetAction();
    return;
  }
  try {
    // release the lock and reload the data
    await Lock.release();
    await loadAll();
  } catch (err) {
    toast.error(err.message);
    lock.value = undefined;
  }
}

async function unLock() {
  action.value = "forceUnlock";
  nextAction.value = async (proceed) => {
    resetAction();
    await setLock(proceed);
  };
}

// forms repositories (issue #414) : the forms live in git, the designer
// saves into the working trees and 'Push to repo' commits & pushes them
const formsRepos = ref([]);
const configRepo = ref(""); // the repository that holds config.yaml
const stagedForms = ref(false); // new forms saved but not yet pushed to a repo
const syncing = ref(false);
const loadingRepos = ref(false);
const showPushModal = ref(false);
const pushRepo = ref(""); // "" means all repositories
const showLoadModal = ref(false);
const loadRepo = ref("");

// unpushed work : a repository with uncommitted/unpushed changes, or new forms
// still staged. Drives the "you have unpushed changes" indicator on Save (repository).
const hasUnpushed = computed(() => stagedForms.value || formsRepos.value.some(r => r.dirty));
// a push or load is in flight : gate other actions that would race it
const busy = computed(() => syncing.value || loadingRepos.value);

async function loadFormsRepos() {
  try {
    const result = await axios.get(`/api/v2/forms-repos`, TokenStorage.getAuthentication());
    formsRepos.value = result.data?.repositories || [];
    configRepo.value = result.data?.configRepo || "";
    stagedForms.value = !!result.data?.staged;
  } catch (err) {
    // a transient failure must not wipe the repo list (it would hide the push
    // button and the unpushed indicator for work that is still unpushed)
  }
}

// the default push target : the config-origin repository (config.yaml lives
// there), falling back to the first forms repository
function defaultRepo() {
  return configRepo.value || formsRepos.value[0]?.name || "";
}

// re-read the forms from disk (working trees + staging) into the designer,
// discarding any in-memory edits
async function reloadFromDisk() {
  forms.value = {};
  categories.value = "";
  roles.value = "";
  constants.value = "";
  currentForm.value = null;
  await loadForms(); // sets a fresh baseline => isDirty false
}

// reload helper that warns when there are unsaved edits (they would be lost)
function withReloadConfirm(run) {
  if (isDirty.value) {
    action.value = "confirmReload";
    nextAction.value = async (proceed) => {
      resetAction();
      if (proceed) await run();
    };
  } else {
    run();
  }
}

// the load dropdown options : one entry per forms repository
const loadRepoOptions = computed(() => formsRepos.value.map(r => ({ value: r.name, label: r.name })));

// Load (repository) : with several repos open a chooser (pick one, or load
// from all) ; with a single repo pull it directly
function loadRepository() {
  if (formsRepos.value.length > 1) {
    // default to the config-origin repo, consistent with Save (repository)
    loadRepo.value = defaultRepo();
    showLoadModal.value = true;
  } else {
    pullAndReload();
  }
}

// pull the given forms repository (or all when name is omitted) from its
// remote, then reload the designer
function pullAndReload(name) {
  showLoadModal.value = false;
  withReloadConfirm(async () => {
    loadingRepos.value = true;
    try {
      const url = name ? `/api/v2/forms-repos/pull/${encodeURIComponent(name)}` : `/api/v2/forms-repos/pull`;
      await axios.post(url, {}, TokenStorage.getAuthentication());
      await reloadFromDisk();
      toast.success(t('designer.loadDone'));
    } catch (err) {
      const error = err.response?.data?.error || err.message;
      const details = err.response?.data?.details;
      toast.error(details ? `${error}: ${details}` : error);
    } finally {
      loadingRepos.value = false;
      await loadFormsRepos(); // refresh the unpushed indicator
      await loadLock(); // the lock poll was suppressed while busy : re-verify now
    }
  });
}

// the dropdown options : one entry per forms repository
const pushRepoOptions = computed(() => formsRepos.value.map(r => ({ value: r.name, label: r.name })));

function pushToRepo() {
  if (isDirty.value) {
    toast.warning(t('designer.syncSaveFirst'));
    return;
  }
  if (formsRepos.value.length > 1) {
    // several forms repositories : choose one (default to the config-origin repo)
    pushRepo.value = defaultRepo();
    showPushModal.value = true;
  } else {
    syncRepos();
  }
}

async function syncRepos(name) {
  showPushModal.value = false;
  syncing.value = true;
  try {
    const url = name ? `/api/v2/forms-repos/sync/${encodeURIComponent(name)}` : `/api/v2/forms-repos/sync`;
    await axios.post(url, {}, TokenStorage.getAuthentication());
    toast.success(t('designer.syncDone'));
  } catch (err) {
    const error = err.response?.data?.error || err.message;
    const details = err.response?.data?.details;
    toast.error(details ? `${error}: ${details}` : error);
  } finally {
    syncing.value = false;
    await loadFormsRepos(); // refresh the unpushed indicator
    await loadLock(); // the lock poll was suppressed while busy : re-verify now
  }
}

// create a new forms file : a file only exists through a form pointing at it,
// so this adds a new form with the given filename as its source. In repository
// mode the new file is staged and assigned to a repository later, on push.
const showNewFile = ref(false);
const newFileName = ref("");

function openNewFile() {
  newFileName.value = "";
  showNewFile.value = true;
}

function addFile() {
  const name = (newFileName.value || "").trim();
  if (!/^[A-Za-z0-9._-]+\.(yaml|yml)$/.test(name)) {
    toast.error(t('designer.newFileInvalid'));
    return;
  }
  if (files.value.includes(name)) {
    toast.error(t('designer.newFileExists'));
    return;
  }
  if (!addForm(name)) return; // addForm refused (eg "New Form" already exists)
  showNewFile.value = false;
  newFileName.value = "";
}

async function validateForms() {
  try {
    const formConfig = assembleForms();
    await Form.validate(formConfig);
    toast.success(t('designer.formsValid'));
  } catch (err) {
    toast.error(err.message);
  }
}

async function saveForms(close = false) {
  if (busy.value) return; // a push/load is in flight : ignore (e.g. Ctrl+S)
  if (!lock.value?.match) {
    toast.error(t('designer.readOnly'));
    return;
  }
  // if there are warnings, show them and do not save
  if (warnings.value.length > 0) {
    showWarnings.value = true;
    toast.warning(t('designer.fixWarnings'));
    return;
  }
  if (!isDirty.value) {
    toast.info(t('designer.noChanges'));
    return;
  }
  try {
    const formConfig = assembleForms();

    // save the forms with axios async
    await Form.save(formConfig);

    setDirtyBaseline(); // the saved content is the new clean baseline
    toast.success(t('designer.formsSaved'));
    if (formsRepos.value.length > 0) await loadFormsRepos(); // saved to a working tree => now unpushed
    if (close && typeof nextAction.value === "function") {
      const cb = nextAction.value;
      nextAction.value = false;
      try {
        cb(true);
      } catch (err) {
        toast.error(err.message);
      }
    }
  } catch (err) {
    toast.error(err.message);
  }
}

function formnames(file) {
  return idmapping.value
    .filter((x) => x.source === file)
    .sort(
      (a, b) =>
        ((a.name || "").toLowerCase() > (b.name || "").toLowerCase() && 1) || -1
    );
}

const hasBaseForms = computed(() => {
  return idmapping.value.some((item) => item.source === undefined);
});

async function loadAll() {
  await loadForms();
  await loadBackups();
  await loadLock();
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) {
    return;
  }
  await loadAll();
  await loadFormsRepos();
  lockInterval.value = setInterval(async () => {
    // skip the poll while a push/load is in flight : a lock refresh that races
    // a sync can pull the rug out from under the in-flight operation
    if (busy.value) return;
    await loadLock();
  }, 5000);
});

onBeforeUnmount(() => {
  // stop polling the lock when leaving the designer (avoids a leaked interval
  // that keeps hitting /api/v2/lock for the life of the SPA)
  if (lockInterval.value) clearInterval(lockInterval.value);
});
</script>
<template>

  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex container-xxl">
      <!-- Modal - delete verify -->
      <BsModal v-if="action == 'delete'" @close="resetAction()">
        <template #title> {{ t('designer.deleteForm') }} {{ currentFormName }} </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">
            {{ t('designer.deleteConfirm') }} <strong>{{ currentFormName }}</strong>?
          </p>
        </template>
        <template #footer>
          <BsButton icon="trash" @click="doDeleteForm()">{{ t('common.delete') }}</BsButton>
        </template>
      </BsModal>

      <!-- Modal - new file -->
      <BsModal v-if="showNewFile" @close="showNewFile = false">
        <template #title> {{ t('designer.newFileTitle') }} </template>
        <template #default>
          <BsInput :isFloating="false" v-model="newFileName" :label="t('designer.newFileLabel')" placeholder="my-forms.yaml" icon="file" :help="t('designer.newFileHelp')" @keyup_enter="addFile()" />
        </template>
        <template #footer>
          <BsButton icon="plus" @click="addFile()">{{ t('common.create') }}</BsButton>
        </template>
      </BsModal>

      <!-- Modal - choose repository to push -->
      <BsModal v-if="showPushModal" @close="showPushModal = false">
        <template #title> {{ t('designer.pushChooseTitle') }} </template>
        <template #default>
          <BsInput :isFloating="false" type="select" icon="code-branch" v-model="pushRepo" :values="pushRepoOptions" name="pushRepo" :label="t('designer.pushRepoLabel')" />
        </template>
        <template #footer>
          <BsButton icon="save" @click="syncRepos(pushRepo)">{{ t('common.save') }}</BsButton>
        </template>
      </BsModal>

      <!-- Modal - choose repository to load -->
      <BsModal v-if="showLoadModal" @close="showLoadModal = false">
        <template #title> {{ t('designer.loadChooseTitle') }} </template>
        <template #default>
          <BsInput :isFloating="false" type="select" icon="code-branch" v-model="loadRepo" :values="loadRepoOptions" name="loadRepo" :label="t('designer.pushRepoLabel')" />
        </template>
        <template #footer>
          <BsButton icon="cloud-arrow-down" @click="pullAndReload(loadRepo)">{{ t('designer.loadFromRepo') }}</BsButton>
          <BsButton icon="cloud-arrow-down" @click="pullAndReload()">{{ t('designer.loadAll') }}</BsButton>
        </template>
      </BsModal>

      <!-- Modal - force unlock-->
      <BsModal v-if="action == 'forceUnlock'" @close="resetAction()">
        <template #title> {{ t('designer.forceUnlock') }} </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">
            {{ t('designer.forceUnlockConfirm') }}<br />
            {{ t('designer.forceUnlockWarning') }}<br /><br />
            {{ t('designer.forceUnlockCare') }}
          </p>
        </template>
        <template #footer>
          <BsButton icon="unlock" @click="nextAction(true)">{{ t('designer.forceUnlock') }}</BsButton>
        </template>
      </BsModal>

      <!-- modal - dirty -->
      <BsModal v-if="action == 'dirty'" @close="resetAction()">
        <template #title> {{ t('designer.unsavedChanges') }} </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">
            {{ t('designer.unsavedConfirm') }}<br />{{ t('designer.unsavedNote') }}
          </p>
        </template>
        <template #footer>
          <BsButton icon="times" @click="nextAction(false)">{{ t('designer.closeWithoutSaving') }}</BsButton>
          <BsButton icon="save" @click="saveForms(true)">{{ t('designer.saveAndClose') }}</BsButton>
        </template>
      </BsModal>

      <!-- modal - confirm reload (discards unsaved changes) -->
      <BsModal v-if="action == 'confirmReload'" @close="nextAction(false)">
        <template #title> {{ t('designer.reloadTitle') }} </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">{{ t('designer.reloadConfirm') }}</p>
        </template>
        <template #footer>
          <BsButton icon="times" @click="nextAction(false)">{{ t('common.cancel') }}</BsButton>
          <BsButton icon="download" @click="nextAction(true)">{{ t('designer.reloadDiscard') }}</BsButton>
        </template>
      </BsModal>

      <BsModal v-if="action == 'restore'" @close="resetAction()">
        <template #title> {{ t('designer.restoreBackup') }} </template>
        <template #default>
          <BsInput type="select_advanced" v-model="backupToRestore" :values="backups" :required="true" name="backup" :label="t('designer.backup')" :sticky="true" :hasError="!backupToRestore" :isLoading="!backups" />
          <BsInput type="checkbox" v-model="backupBeforeRestore" :label="t('designer.backupBeforeRestore')" />
        </template>
        <template #footer>
          <BsButton icon="undo" @click="restoreBackup(); resetAction()">{{ t('designer.restore') }}</BsButton>
        </template>
      </BsModal>

      <BsOffCanvas v-if="showWarnings" :show="true" icon="triangle-exclamation" :title="t('designer.warnings')" @close="showWarnings = false">
        <template #actions> </template>
        <template #default>
          <p v-for="(w, i) in warnings" :key="'warning' + i" class="mb-3" v-html="w"></p>
        </template>
      </BsOffCanvas>
      <AppSettings v-if="authenticated" :title="t('designer.title')" icon="pencil">
        <template #feedback>
          <template v-if="lock">
            <popper v-if="lock.lock">
              <button class="btn ms-2" type="button" :class="{
                'btn-warning': !lock.match,
                'btn-outline-success': lock.match,
              }">
                <span class="icon">
                  <font-awesome-icon icon="lock" size="sm" />
                </span>
                <span v-if="lock.lock && !lock.match" class="mr-1">
                  {{ t('designer.lockedBy') }} {{ lock.lock.username }}</span>
                <span v-if="lock.lock && lock.match" class="mr-1">
                  {{ t('designer.lockedByMe') }}</span>
              </button>
              <template #content>
                {{ t('designer.user') }}: {{ lock.lock.username }}<br />
                {{ t('designer.type') }}: {{ lock.lock.type }}<br />
                Created: {{ lockAge }}
              </template>
            </popper>
            <BsButton v-if="lock.free" cssClass="ms-2" icon="unlock" @click="setLock()">{{ t('designer.startDesigner') }}</BsButton>
            <BsButton v-if="!lock.match && !lock.free" cssClass="ms-2" icon="unlock" @click="unLock()">{{ t('designer.forceUnlock') }}</BsButton>
            <BsButton v-if="lock.match" cssClass="ms-2" icon="unlock" @click="releaseLock()">{{ t('designer.releaseLock') }}</BsButton>
            <popper v-if="hasBaseForms">
              <button class="btn ms-2 btn-warning" type="button">
                <span class="icon">
                    <font-awesome-icon icon="exclamation-triangle" size="sm" />
                </span>
                <span>{{ t('designer.deprecationWarning') }}</span>
              </button>
              <template #content>
                {{ t('designer.deprecationMsg') }}<br />
                {{ t('designer.deprecationAction') }}<br />
                {{ t('designer.deprecationMove') }}
              </template>
            </popper>            
          </template>
          <Transition appear>
            <div v-if="warnings.length > 0" class="ms-2">
              <button @click="showWarnings = !showWarnings" class="btn btn-warning me-3">
                <span class="me-2">
                  <font-awesome-icon icon="exclamation-triangle" />
                </span>
                <span class="mr-1">{{ showWarnings ? t('designer.hideWarnings') : t('designer.hasWarnings') }} {{ t('designer.warnings') }}
                </span>
              </button>
            </div>
          </Transition>
        </template>
        <template #actions>
          <small v-if="lockError!==''" class="d-inline-flex mb-3 px-2 py-1 fw-semibold text-warning-emphasis bg-warning-subtle border border-warning-subtle rounded-2">{{ lockError }}</small>
          <template v-if="lock && lock.match">
            <BsButton v-if="currentTab == 'Forms'" class="ms-2" icon="file-circle-plus" @click="openNewFile()" :disabled="busy">{{ t('designer.newFile') }}</BsButton>
            <BsButton v-if="formsRepos.length > 0" class="ms-2" icon="cloud-arrow-down" @click="loadRepository" :disabled="busy">{{ loadingRepos ? t('designer.loading') : t('designer.loadRepository') }}</BsButton>
            <BsButton class="ms-2" icon="check" @click="validateForms" :disabled="!isDirty || busy">{{ t('designer.validate') }}</BsButton>
            <BsButton class="ms-2" :colorClass="isDirty ? 'orange' : 'primary'" icon="save" @click="saveForms" :disabled="!isValid || !isDirty || busy">{{ formsRepos.length > 0 ? t('designer.saveLocal') : t('designer.save') }}</BsButton>
            <BsButton v-if="formsRepos.length > 0" class="ms-2" :colorClass="hasUnpushed ? 'orange' : 'primary'" icon="code-branch" @click="pushToRepo" :disabled="isDirty || busy">{{ syncing ? t('designer.syncing') : t('designer.saveRepository') }}</BsButton>
            <BsButton v-if="formsRepos.length === 0" class="ms-2" icon="undo" @click="restore">{{ t('designer.restore') }}</BsButton>
          </template>
          <small v-if="lock && !lock.match && !lock.free" class="d-inline-flex mb-3 px-2 py-1 fw-semibold text-warning-emphasis bg-warning-subtle border border-warning-subtle rounded-2">{{ t('designer.readOnly') }}</small>
        </template>
        <template #default v-if="lock && !lock.free">
          <div class="row">
            <div class="col-md-9">
              <ul class="nav nav-tabs">
                <li v-for="t in tabs" :key="t" class="nav-item">
                  <a class="nav-link" :class="{ active: isCurrentTab(t) }" role="button" @click="selectTab(t)">{{ t }}</a>
                </li>
              </ul>

              <div v-if="loaded && currentTab == 'Categories'">
                <BsInput type="editor" :isFloating="false" v-model="categories" @save="saveForms()" lang="yaml" :liveSync="true" style="width: 100%; height: 75vh; font-size: 1rem" />
              </div>
              <div v-if="loaded && currentTab == 'Roles'">
                <BsInput type="editor" :isFloating="false" v-model="roles" @save="saveForms()" lang="yaml" :liveSync="true" style="width: 100%; height: 75vh; font-size: 1rem" />
              </div>
              <div v-if="loaded && currentTab == 'Constants'">
                <BsInput type="editor" :isFloating="false" v-model="constants" @save="saveForms()" lang="yaml" :liveSync="true" style="width: 100%; height: 75vh; font-size: 1rem" />
              </div>
              <div v-if="currentTab == 'Forms'">
                <template v-if="loaded">
                  <div v-for="f in files" :key="'file' + f">
                    <template v-for="n in formnames(f)" :key="n.id">
                      <div v-if="isCurrentForm(n.id)">
                        <BsInput type="editor" :isFloating="false" v-model="forms[n.id]" @save="saveForms()" lang="yaml" :liveSync="true" style="width: 100%; height: 75vh; font-size: 1rem" />
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </div>
            <div class="col-md-3 overflow-y-scroll">
              <template v-for="f in files" :key="'file' + f">
                <ol class="list-group list-group-flush">
                  <li class="list-group-item">
                    <div class="ms-2 me-auto">
                      <div class="d-flex justify-content-between align-items-start">
                        <span class="fw-bold">{{ f || t('designer.baseFile') }}</span>
                      
                        <span role="button" class="text-success" @click="addForm(f)"><font-awesome-icon icon="plus" /></span>
                      </div>

                      <ul class="list-unstyled w-100 d-inline-block">
                        <li v-for="n in formnames(f)" :key="n.id" class="d-flex justify-content-between align-items-start w-100 d-inline-block">
                          <a role="button" @click="selectForm(n.id)" :class="{ 'fw-bold': isCurrentForm(n.id) }">
                            <span>{{ n.name }}</span>
                          </a>
                          <span role="button" class="text-danger" @click="deleteForm(n.id)"><font-awesome-icon icon="times" /></span>
                        </li>
                      </ul>
                    </div>
                  </li>
                </ol>
              </template>
            </div>
          </div>
        </template>
      </AppSettings>
    </main>
  </div>
</template>
<style lang="scss" scoped>
.v-enter-from {
  opacity: 0;
  translate: -100px 0;
}

.v-enter-to {
  opacity: 1;
  translate: 0 0;
}

.v-leave-from {
  opacity: 1;
  translate: 0 0;
}

.v-leave-to {
  opacity: 0;
  translate: 100px 0;
}
</style>
<route lang="yaml">
meta:
  layout: standard
</route>
