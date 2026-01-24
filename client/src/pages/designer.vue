<script setup>
import { ref, onMounted, computed } from "vue";
import Form from "@/lib/Form";
import Lock from "@/lib/Lock";
import Backup from "@/lib/Backup";
import Profile from "@/lib/Profile";
import YAML from "yaml";
import { useToast } from "vue-toastification";
import { useRoute, useRouter } from "vue-router";
import Helpers from "@/lib/Helpers";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

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

const toast = useToast();
const route = useRoute();
const router = useRouter();

const isValid = computed(() => {
  return warnings.value.length == 0;
});

const isDirty = ref(false);

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
  return idmapping.value.find((x) => x.id == currentForm.value).name || null;
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
  } catch (err) {
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
  currentForm.value = idmapping.value[0].id || null;
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
    query.form = name;
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
    toast.error("Form 'New Form' already exists");
    return;
  }

  const id = `form_${Object.keys(forms.value).length}`;
  if (file) {
    formTemplate.source = file;
  }
  forms.value[id] = YAML.stringify({ ...formTemplate, source: file });
  currentForm.value = id;
  isDirty.value = true;
}

function doDeleteForm() {
  // delete the form by id from forms list
  if (currentFormName.value) {
    delete forms.value[currentForm.value];
    isDirty.value = true;
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
    toast.success("Backup restored");
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

async function validateForms() {
  try {
    const formConfig = assembleForms();
    await Form.validate(formConfig);
    toast.success("Forms are valid");
  } catch (err) {
    toast.error(err.message);
  }
}

async function saveForms(close = false) {
  if (!lock.value.match) {
    toast.error("The editor is currently read-only");
    return;
  }
  // if there are warnings, show them and do not save
  if (warnings.value.length > 0) {
    showWarnings.value = true;
    toast.warning("Fix the warnings before saving");
    return;
  }
  if (!isDirty.value) {
    toast.info("No changes to save");
    return;
  }
  try {
    const formConfig = assembleForms();

    // save the forms with axios async
    await Form.save(formConfig);

    isDirty.value = false;
    toast.success("Forms saved successfully");
    if (close) {
      try {
        nextAction.value(true);
        nextAction.value = null;
      } catch (err) {
        // toast.error(err.message);
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
  lockInterval.value = setInterval(async () => {
    await loadLock();
  }, 5000);
});
</script>
<template>

  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex container-xxl">
      <!-- Modal - delete verify -->
      <BsModal v-if="action == 'delete'" @close="resetAction()">
        <template #title> Delete {{ currentFormName }} </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">
            Are you sure you want to delete <strong>{{ currentFormName }}</strong>?
          </p>
        </template>
        <template #footer>
          <BsButton icon="trash" @click="doDeleteForm()">Delete</BsButton>
        </template>
      </BsModal>

      <!-- Modal - force unlock-->
      <BsModal v-if="action == 'forceUnlock'" @close="resetAction()">
        <template #title> Force Unlock </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">
            Are you sure you want to force the unlock ?<br />
            Whomever has the lock now, will loose all changes<br />
            and will not be able to save them.<br /><br />
            Proceed with care and respect.
          </p>
        </template>
        <template #footer>
          <BsButton icon="unlock" @click="nextAction(true)">Force Unlock</BsButton>
        </template>
      </BsModal>

      <!-- modal - dirty -->
      <BsModal v-if="action == 'dirty'" @close="resetAction()">
        <template #title> Unsaved Changes </template>
        <template #default>
          <p class="mt-3 fs-6 user-select-none">
            Are you sure you want to leave the designer ?<br />You have unsaved
            changes.
          </p>
        </template>
        <template #footer>
          <BsButton icon="times" @click="nextAction(false)">Close without saving</BsButton>
          <BsButton icon="save" @click="saveForms(true);resetAction();">Save and Close</BsButton>
        </template>
      </BsModal>

      <BsModal v-if="action == 'restore'" @close="resetAction()">
        <template #title> Restore backup </template>
        <template #default>
          <BsInput type="select_advanced" v-model="backupToRestore" :values="backups" :required="true" name="backup" label="Backup" :sticky="true" :hasError="!backupToRestore" :isLoading="!backups" />
          <BsInput type="checkbox" v-model="backupBeforeRestore" label="Make a backup before restore ?" />
        </template>
        <template #footer>
          <BsButton icon="undo" @click="restoreBackup(); resetAction()">Restore</BsButton>
        </template>
      </BsModal>

      <BsOffCanvas v-if="showWarnings" :show="true" icon="triangle-exclamation" title="Warnings" @close="showWarnings = false">
        <template #actions> </template>
        <template #default>
          <p v-for="(w, i) in warnings" :key="'warning' + i" class="mb-3" v-html="w"></p>
        </template>
      </BsOffCanvas>
      <AppSettings v-if="authenticated" title="Designer" icon="pencil">
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
                  Locked by {{ lock.lock.username }}</span>
                <span v-if="lock.lock && lock.match" class="mr-1">
                  Locked by me</span>
              </button>
              <template #content>
                User: {{ lock.lock.username }}<br />
                Type: {{ lock.lock.type }}<br />
                Created: {{ lockAge }}
              </template>
            </popper>
            <BsButton v-if="lock.free" cssClass="ms-2" icon="unlock" @click="setLock()">Start Designer</BsButton>
            <BsButton v-if="!lock.match && !lock.free" cssClass="ms-2" icon="unlock" @click="unLock()">Force unlock</BsButton>
            <BsButton v-if="lock.match" cssClass="ms-2" icon="unlock" @click="releaseLock()">Release lock</BsButton>
            <popper v-if="hasBaseForms">
              <button class="btn ms-2 btn-warning" type="button">
                <span class="icon">
                    <font-awesome-icon icon="exclamation-triangle" size="sm" />
                </span>
                <span>Deprecation warning</span>
              </button>
              <template #content>
                Forms detected in the base config file (config.yaml or forms.yaml), which is DEPRECATED.<br />
                Please move forms to the forms/ folder. The base config should only contain categories, roles, and constants.<br />
                Please move them under a file in the forms directory.
              </template>
            </popper>            
          </template>
          <Transition appear>
            <div v-if="warnings.length > 0" class="ms-2">
              <button @click="showWarnings = !showWarnings" class="btn btn-warning me-3">
                <span class="me-2">
                  <font-awesome-icon icon="exclamation-triangle" />
                </span>
                <span class="mr-1">{{ showWarnings ? "Hide" : "This design has" }} Warnings
                </span>
              </button>
            </div>
          </Transition>
        </template>
        <template #actions>
          <small v-if="lockError!==''" class="d-inline-flex mb-3 px-2 py-1 fw-semibold text-warning-emphasis bg-warning-subtle border border-warning-subtle rounded-2">{{ lockError }}</small>
          <template v-if="lock && lock.match">
            <BsButton class="ms-2" icon="check" @click="validateForms" :disabled="!isDirty">Validate</BsButton>
            <BsButton class="ms-2" icon="save" @click="saveForms" :disabled="!isValid || !isDirty">Save</BsButton>
            <BsButton class="ms-2" icon="undo" @click="restore">Restore</BsButton>
          </template>
          <small v-if="lock && !lock.match && !lock.free" class="d-inline-flex mb-3 px-2 py-1 fw-semibold text-warning-emphasis bg-warning-subtle border border-warning-subtle rounded-2">The editor is read-only</small>
        </template>
        <template #default v-if="lock && !lock.free">
          <div class="row">
            <div class="col-md-9">
              <ul class="nav nav-tabs">
                <li v-for="t in tabs" :key="t" class="nav-item">
                  <a class="nav-link" :class="{ active: isCurrentTab(t) }" role="button" @click="selectTab(t)">{{ t }}</a>
                </li>
              </ul>

              <div v-if="currentTab == 'Categories'">
                <BsInput type="editor" :isFloating="false" v-model="categories" @save="saveForms()" lang="yaml" style="width: 100%; height: 75vh; font-size: 1rem" @dirty="isDirty = true" />
              </div>
              <div v-if="currentTab == 'Roles'">
                <BsInput type="editor" :isFloating="false" v-model="roles" @save="saveForms()" lang="yaml" style="width: 100%; height: 75vh; font-size: 1rem" @dirty="isDirty = true" />
              </div>
              <div v-if="currentTab == 'Constants'">
                <BsInput type="editor" :isFloating="false" v-model="constants" @save="saveForms()" lang="yaml" style="width: 100%; height: 75vh; font-size: 1rem" @dirty="isDirty = true" />
              </div>
              <div v-if="currentTab == 'Forms'">
                <template v-if="loaded">
                  <div v-for="f in files" :key="'file' + f">
                    <template v-for="n in formnames(f)" :key="n.id">
                      <div v-if="isCurrentForm(n.id)">
                        <BsInput type="editor" :isFloating="false" v-model="forms[n.id]" @save="saveForms()" lang="yaml" style="width: 100%; height: 75vh; font-size: 1rem" @dirty="isDirty = true" />
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
                        <span class="fw-bold">{{ f || "Base file" }}</span>
                      
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
