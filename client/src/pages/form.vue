<script setup>
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import Profile from "@/lib/Profile";
import Form from "@/lib/Form";
import { useAppStore } from "@/stores/app";
import Helpers from "@/lib/Helpers";
import axios from "axios";
import Lodash from "lodash";
import State from "@/lib/State";
import Navigate from "@/lib/Navigate";
import TokenStorage from "@/lib/TokenStorage";
import YAML from "yaml";
import { provide, reactive, computed } from "vue";

// use
const route = useRoute();
const router = useRouter();

const store = useAppStore();

// refs
const key = ref(0); // key to force rerender
const authenticated = ref(false); // flag to show/hide form, only show if authenticated, otherwise redirect to login (is automatically done by the router)
const currentForm = ref(null); // holds the current form
const formConfig = ref({}); // holds the form configuration
const constants = ref({}); // holds the constants
const formLoaded = ref(false); // flag to know if form is loaded
const showHelp = ref(false); // flag to show/hide help
const formNotFound = ref(false); // flag to know if form is not found
const filterOutput = ref(true); // flag to show/hide filter output

// ---------------------------------------------------------------------------
// Nested subform editor stack
//
// Each entry represents a subform currently being edited as a tab:
//   { id, title, subform, snapshot, onSave }
// - `snapshot` is a deep clone of the row at the time the tab was opened
//   and is passed to <AppForm :initialData>. The edited value comes back via
//   the `@save` event and is forwarded to the list field's `onSave` callback.
// - Parent tabs are rendered disabled so the user cannot skip over an
//   in-progress edit; use Save or × to come back to them.
// ---------------------------------------------------------------------------
// Edit stack for nested subform editing.
//
// Each entry represents a subform currently being edited:
//   { id, title, subtitle, subform, snapshot, draft, showHelp, onSave }
// - `snapshot` is a deep clone of the row at the time editing began and is
//   passed to <AppForm :initialData>. The edited value comes back via the
//   `@save` event and is forwarded to the list field's `onSave` callback.
// - While the stack is non-empty, the main form is hidden and the deepest
//   subform in the stack takes its place (title / help / breadcrumbs all
//   switch to the active entry). Earlier entries remain mounted (v-show)
//   so their drafts are preserved when the user goes deeper and back.
// - AppListField components call `pushEdit(...)` (injected) to open a new
//   level at any nesting depth; closing a level also removes its descendants.
// ---------------------------------------------------------------------------
const editStack = reactive([]);
let nextEditId = 1;

// The deepest (currently visible) subform entry, or undefined when the main
// form is shown. Drives the title, breadcrumbs and help block in the template.
const activeEntry = computed(() => editStack[editStack.length - 1]);

function pushEdit({ title, subtitle, subform, row, onSave }) {
    const id = `edit-${nextEditId++}`;
    const snapshot = row ? JSON.parse(JSON.stringify(row)) : {};
    const entry = reactive({
        id, title, subtitle, subform, snapshot,
        draft: {},
        showHelp: subform?.showHelp === true,
        onSave,
    });
    editStack.push(entry);
    return id;
}

function popEdit(id) {
    const idx = editStack.findIndex(e => e.id === id);
    if (idx < 0) return;
    // Remove the target entry and anything pushed on top of it.
    editStack.splice(idx, editStack.length - idx);
}

function saveEdit(id, value) {
    const entry = editStack.find(e => e.id === id);
    if (!entry) return;
    try {
        entry.onSave?.(value);
    } finally {
        popEdit(id);
    }
}

provide('formEditStack', {
    push: pushEdit,
    pop: popEdit,
});
const hideForm = ref(false); // possible action to hide form onsubmit for example
const formdata = ref({}); // the eventual object sent to the api in the correct hierarchy
const showExtraVars = ref(false); // flag to show/hide extravars
const job = ref({}); // holds the job data
const message = ref(""); // holds the message of the job
const error = ref(""); // holds the error of the job
const viewAsYaml = ref(false); // flag to show extravars as yaml
const subjob = ref({}); // output of last subjob
const form = ref({}); // the form data mapped to the form -> hold the real data
const visibility = ref({}); // holds which fields are visiable or not
const timeout = ref(undefined); // determines how long we should show the result of run
const enableVerbose = ref(false); // flag to enable verbose mode
const jobId = ref(undefined); // holds the current jobid
const abortTriggered = ref(false); // flag abort is triggered,
const pauseJsonOutput = ref(false); // flag to pause jsonoutput interval
const fileProgress = ref({}); // holds the progress of file uploads
const status = ref(""); // status of form
const initialFormData = ref({}); // holds initial data for pre-filling the form

// Schedule off-canvas state
const showScheduleOffcanvas = ref(false);
const scheduleAction = ref('schedule'); // 'schedule' or 'run-later'
const scheduleForm = ref({
    name: '',
    one_time_run: false,
    cron: '',
    run_at: null
});
const scheduleSubmitting = ref(false);

// Store off-canvas state
const showStoreOffcanvas = ref(false);
const storeForm = ref({
    name: '',
    description: '',
    expires_at: null
});
const storeSubmitting = ref(false);

// Load off-canvas state
const showLoadOffcanvas = ref(false);
const storedJobs = ref([]);
const loadSubmitting = ref(false);

// Context describing what to store / what to load into. Set just before
// opening the store or load off-canvas so a single dialog is reused by both
// the main form and any active subform tab. Shape:
//   { scope: 'form' | 'subform',
//     formName: string,       // used as stored_jobs.form_name
//     title: string,          // displayed in the off-canvas header
//     getData: () => object,  // payload to serialise on Save
//     onLoad: (parsed) => void // applies a loaded record
//   }
const storeCtx = ref(null);

function buildMainStoreCtx() {
    return {
        scope: 'form',
        formName: currentForm.value.name,
        title: currentForm.value.name,
        getData: () => getFilteredRawFormData(),
        onLoad: (parsed) => {
            initialFormData.value = parsed;
            key.value++;
        },
    };
}

/******************************** */
// computed
/******************************** */

// calculated formdata as yaml
const formdataYaml = computed(() => YAML.stringify(formdata.value));

// Build the output object for a subform draft, applying the same rules as
// `stripSubformInternals` in AppForm.vue: drop __user__, honour `noOutput`
// and `outputObject` (implicit for expression/file/list/table/yaml/datetime),
// apply `valueColumn` for scalars, and adjust datetime month (0-11 -> 1-12).
// `model` is intentionally ignored - subform rows are flat by design.
function buildSubformOutput(entry) {
  if (!entry?.subform?.fields) return {};
  const raw = entry.draft || {};
  const out = {};
  for (const item of entry.subform.fields) {
    if (!item?.name || item.name === '__user__') continue;
    if (item.noOutput) continue;
    if (!(item.name in raw)) continue;

    const outputObject =
      item.outputObject ||
      item.type === 'expression' ||
      item.type === 'file' ||
      item.type === 'table' ||
      item.type === 'list' ||
      item.type === 'yaml' ||
      item.type === 'datetime' ||
      false;

    let value = Helpers.deepClone(raw[item.name]);
    if (item.type === 'datetime' && item.dateType === 'month' && value && typeof value === 'object') {
      value = { ...value, month: typeof value.month === 'number' ? value.month + 1 : value.month };
    }
    if (!outputObject) {
      value = Helpers.getFieldValue(value, item.valueColumn || '', true);
    }
    out[item.name] = value;
  }
  return out;
}

// When editing a subform, the right-hand "Extravars" panel switches to show
// the draft of the active subform instead of the main-form output. Outside
// subform editing this is just `formdata`.
const displayedOutput = computed(() =>
  activeEntry.value ? buildSubformOutput(activeEntry.value) : formdata.value
);
const displayedOutputYaml = computed(() => YAML.stringify(displayedOutput.value));
const displayedOutputTitle = computed(() =>
  activeEntry.value ? `Subform output - ${activeEntry.value.title}` : 'Extra vars'
);

// filter job output
const filteredJobOutput = computed(() => {
  if (!filterOutput.value) return job.value.output?.replace(/\r\n/g, "<br>") || "";
  return job.value.output
    ?.replace(/<span class='low[^<]*<\/span>/g, "")
    .replace(/\r\n/g, "<br>")
    .replace(/(<br>\s*){3,}/gi, "<br><br>") || ""; // eslint-disable-line
});

// filter subjob output
const filteredSubJobOutput = computed(() => {
  if (!filterOutput.value) return subjob.value.output?.replace(/\r\n/g, "<br>") || "";
  return subjob.value.output
    ?.replace(/<span class='low[^<]*<\/span>/g, "")
    .replace(/\r\n/g, "<br>")
    .replace(/(<br>\s*){3,}/gi, "<br><br>") || ""; // eslint-disable-line
});

const formStatus = computed(() => {
  if (status.value == "running") {
    return {
      label: "Running",
      color: "primary",
      icon: "spinner",
      disabled: true,
      reload: false,
      abort: true,
    };
  } else if (status.value == "success") {
    return {
      label: "Finished",
      color: "success",
      icon: "check",
      disabled: false,
      reload: true,
      abort: false,
    };
  } else if (status.value == "failed") {
    return {
      label: "Failed",
      color: "danger",
      icon: "exclamation-triangle",
      disabled: false,
      reload: true,
      abort: false,
    };
  } else if (status.value == "warning") {
    return {
      label: "Finished with warning",
      color: "warning",
      icon: "exclamation-triangle",
      disabled: false,
      reload: true,
      abort: false,
    };
  }else if (status.value == "approve") {
    return {
      label: "Waiting for approval",
      color: "warning",
      icon: "spinner",
      disabled: false,
      reload: true,
      abort: false,
    };
  } else if (status.value == "abandoned") {
    return {
      label: "Abandoned",
      color: "warning",
      icon: "exclamation-triangle",
      disabled: false,
      reload: true,
      abort: false,
    };
  } else if (status.value == "rejected") {
    return {
      label: "Rejected",
      color: "warning",
      icon: "exclamation-triangle",
      disabled: false,
      reload: true,
      abort: false,
    };
  } else if (status.value == "aborted") {
    return {
      label: "Aborted",
      color: "warning",
      icon: "exclamation-triangle",
      disabled: false,
      reload: true,
      abort: false,
    };
  } else if (status.value == "initializing") {
    return {
      label: "Initializing",
      color: "primary",
      icon: "spinner",
      disabled: true,
      reload: false,
      abort: false,
    };
  } else if (status.value == "stabilizing") {
    return {
      label: "Stabilizing form",
      color: "primary",
      icon: "spinner",
      disabled: true,
      reload: false,
      abort: false,
    };
  } else if (status.value == "submitting") {
    return {
      label: "Submitting form",
      color: "primary",
      icon: "spinner",
      disabled: true,
      reload: false,
      abort: false,
    };
  } else {
    return {
      label: "Pending",
      color: "secondary",
      icon: "spinner",
      disabled: false,
      reload: false,
      abort: false,
    };
  }
});

/******************************** */
// methods
/******************************** */

async function reloadForm(reset = true) {
  if (reset) {
    resetResult();
  }
  await loadForm();
  key.value++;
}

function toggleShowExtraVars() {
  showExtraVars.value = !showExtraVars.value;
  // Generate JSON immediately when opening extravars panel to avoid delay
  if (showExtraVars.value) {
    generateJsonOutput();
  }
}

// do action after form submit
function doAction(a, jobid) {
  
  const action = Object.keys(a)[0];
  const value = a[action];
  var wait = 0;
  var form = "";
  if (typeof value == "string") {
    var tmp = value.split(/,(.*)/s);
    wait = parseInt(tmp[0]);
    form = tmp[1];
  } else {
    wait = parseInt(value);
  }
  if (action == "clear") {
    setTimeout(() => {
      reloadForm(false);
    }, wait * 1000);
  }
  if (action == "home") {
    setTimeout(() => {
      Navigate.toHome(router);
    }, wait * 1000);
  }
  if (action == "load") {
    setTimeout(() => {
      Navigate.toPath(router, "/form", { form: form, __previous_jobid__: jobid }, true);
    }, wait * 1000);
  }
  if (action == "reload") {
    setTimeout(() => {
      reloadForm();
    }, wait * 1000);
  }
  if (action == "hide") {
    setTimeout(() => {
      hideForm.value = true;
    }, wait * 1000);
  }
  if (action == "show") {
    setTimeout(() => {
      hideForm.value = false;
    }, wait * 1000);
  }
}

// when the form component triggers a change
// we can regenerate the json output
// for this we need to know which fields are visible
// so we the child passes the visibility information
function formChanged(formObjectData) {
  visibility.value = formObjectData.visibility;
  generateJsonOutput(); 
}

// Get filtered raw form data (excludes constants, passwords, system fields)
function getFilteredRawFormData() {
  const rawFormData = {};
  currentForm.value.fields.forEach((field) => {
    const fieldName = field.name;
    
    // Skip if field value not in form
    if (!(fieldName in form.value)) return;
    
    // Skip constants (loaded from config, not user input)
    if (field.type === 'constant') return;
    
    // Skip password fields for security
    if (field.type === 'password') return;
    
    // Skip system fields
    if (fieldName === 'server' || fieldName === 'database' || fieldName === 'metadata') return;
    
    // Include this field
    rawFormData[fieldName] = form.value[fieldName];
  });
  return rawFormData;
}

// generate the form json output
function generateJsonOutput(filedata = {}) {
  var fd = {};
  try {
    currentForm.value.fields.forEach((item) => {
      if (visibility.value[item.name] && !item.noOutput) {
        var fieldmodel = [].concat(item.model || []);
        var outputObject =
          item.outputObject ||
          item.type == "expression" ||
          item.type == "file" ||
          item.type == "table" ||
          item.type == "list" ||
          item.type == "yaml" ||
          (item.type == "datetime") || 
          false;
        var outputValue = undefined;

        if (item.name in filedata) {
          outputValue = filedata[item.name];
        } else {
          outputValue = Helpers.deepClone(form.value[item.name]);
        }

        // convert month from 0-11 to 1-12 for month picker
        if (item.type === "datetime" && item.dateType === "month" && outputValue && typeof outputValue === "object") {
          outputValue = {
            ...outputValue,
            month: typeof outputValue.month === "number" ? outputValue.month + 1 : outputValue.month
          };
        }

        if (!outputObject) {
          outputValue = Helpers.getFieldValue(
            outputValue,
            item.valueColumn || "",
            true
          );
        }

        if (fieldmodel.length == 0) {
          fd[item.name] = Helpers.deepClone(outputValue);
        } else {
          fieldmodel.forEach((f) => {
            f.split(/\s*\.\s*/).reduce((master, obj, level, arr) => {
              var arrsplit = undefined;

              if (level === arr.length - 1) {
                if (obj.match(/.*\[[0-9]+\]$/)) {
                  arrsplit = obj.split(/\[([0-9]+)\]$/);
                  if (master[arrsplit[0]] === undefined) {
                    master[arrsplit[0]] = [];
                  }
                  if (master[arrsplit[0]][arrsplit[1]] === undefined) {
                    master[arrsplit[0]][arrsplit[1]] = {};
                  }
                  master[arrsplit[0]][arrsplit[1]] = outputValue;
                  return master[arrsplit[0]][arrsplit[1]];
                } else {
                  if (master[obj] === undefined) {
                    master[obj] = outputValue;
                  } else if (typeof master[obj] !== 'object' || master[obj] === null || typeof outputValue !== 'object' || outputValue === null) {
                    // If either value is primitive, just overwrite instead of merging
                    master[obj] = outputValue;
                  } else {
                    master[obj] = Lodash.merge(master[obj], outputValue);
                  }
                  return master[obj];
                }
              } else {
                if (obj.match(/.*\[[0-9]+\]$/)) {
                  arrsplit = obj.split(/\[([0-9]+)\]$/);
                  if (master[arrsplit[0]] === undefined) {
                    master[arrsplit[0]] = [];
                  }
                  if (master[arrsplit[0]][arrsplit[1]] === undefined) {
                    master[arrsplit[0]][arrsplit[1]] = {};
                  }
                  return master[arrsplit[0]][arrsplit[1]];
                } else {
                  // Check if master is an object before trying to traverse
                  if (typeof master !== 'object' || master === null) {
                    // Can't traverse into a primitive value, skip this path
                    return master;
                  }
                  if (master[obj] === undefined) {
                    master[obj] = {};
                  } else if (typeof master[obj] !== 'object' || master[obj] === null) {
                    // Path already contains a primitive, can't traverse further
                    return master;
                  }
                  return master[obj];
                }
              }
            }, fd);
          });
        }
      }
    });
  } catch (err) {
    toast.error(
      "Failed to generate json output.\r\nContact the developer.\r\n" +
      (err.message || err.toString())
    );
  }
  formdata.value = fd;
}

// upload a file
async function uploadFile(fieldname, file) {
  // toast.info(`Start uploading ${file.name}`);
  var uploadFormData = new FormData();
  uploadFormData.append("file", file);
  const config = {
    ...TokenStorage.getAuthenticationMultipart(),
    onUploadProgress: (progressEvent) => {
      fileProgress.value[fieldname] = Math.round(
        (progressEvent.loaded / progressEvent.total) * 100
      );
      if (fileProgress.value[fieldname] == 100) {
        toast.success(`File ${file.name} uploaded`);
        setTimeout(() => {
          fileProgress.value[fieldname] = undefined;
        }, 2000);
      }
    },
  };
  const result = await axios.post(
    `/api/v2/job/upload/`,
    uploadFormData,
    config
  );
  return result.data;
}

async function submitForm(formObjectData) {
  var postdata = {};
  postdata.files = {};

  // the visibility data is passed from the AppForm component
  // we need it to know which fields are visible and which are not
  visibility.value = formObjectData.visibility;

  currentForm.value.fields
    .filter((f) => f.type == "file" && form.value[f.name]?.name)
    .forEach((f) => {
      postdata.files[f.name] = form.value[f.name];
    });

  try {
    const fileKeys = Object.keys(postdata.files);
    const uploadPromises = fileKeys.map(async (key) => {
      try {
        var result = await uploadFile(key, postdata.files[key]);
        postdata.files[key] = result;
      } catch (e) {
        console.log(e);
        throw new Error("Failed uploading files");
      }
    });
    await Promise.all(uploadPromises);
  } catch (err) {
    toast.error(err.toString());
    resetResult();
    throw new Error("Failed uploading files");
  }

  pauseJsonOutput.value = true;
  generateJsonOutput(postdata.files);
  postdata.extravars = formdata.value;
  if (enableVerbose.value) {
    postdata.extravars.__verbose__ = true;
  }
  postdata.formName = currentForm.value.name;
  // Store raw form data for potential re-use (exclude sensitive/irrelevant fields)
  postdata.rawFormData = getFilteredRawFormData();
  console.log('Submitting with rawFormData:', Object.keys(postdata.rawFormData));
  postdata.credentials = {};
  currentForm.value.fields
    .filter((f) => f.asCredential == true)
    .forEach((f) => {
      postdata.credentials[f.name] = formdata.value[f.name];
    });
  launchForm(postdata);
}

async function copyToClipboard(textToCopy) {
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(textToCopy);
  } else {
    // Use the 'out of viewport hidden text area' trick
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;

    // Move textarea out of the viewport so it's not visible
    textArea.style.position = "absolute";
    textArea.style.left = "-999999px";

    document.body.prepend(textArea);
    textArea.select();

    try {
      document.execCommand("copy");
    } catch (error) {
      console.error(error);
    } finally {
      textArea.remove();
    }
  }
}

// copy to clipboard
async function clip(v, doNotStringify = false, asYaml = false) {
  if (doNotStringify) {
    try {
      await copyToClipboard(v);
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Error copying to clipboard : \n" + err.toString());
    }
  } else {
    try {
      if (asYaml) {
        await copyToClipboard(YAML.stringify(v));
      } else {
        await copyToClipboard(JSON.stringify(v, null, 2));
      }
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Error copying to clipboard : \n" + err.toString());
    }
  }
}

// reset result
function resetResult() {
  clearTimeout(timeout.value);
  status.value = "";
  message.value = "";
  error.value = "";
  subjob.value = {};
  job.value = {};
}

// Handle submit action from AppForm component
function handleSubmitAction({ action, visibility: formVisibility }) {
  visibility.value = formVisibility;
  
  switch(action) {
    case 'submit':
      // Main submit action - trigger form submission
      status.value = 'initializing';
      submitForm({ visibility: formVisibility });
      break;
    case 'schedule':
      openScheduleOffcanvas('schedule');
      break;
    case 'run-later':
      openScheduleOffcanvas('run-later');
      break;
    case 'store':
      storeCtx.value = buildMainStoreCtx();
      openStoreOffcanvas();
      break;
  }
}

// Open schedule off-canvas
function openScheduleOffcanvas(action = 'schedule') {
  scheduleAction.value = action;
  
  // Reset schedule form with appropriate defaults
  if (action === 'schedule') {
    scheduleForm.value = {
      name: '',
      one_time_run: false,
      cron: '0 0 * * *', // Default: daily at midnight
      run_at: null
    };
  } else { // run-later
    scheduleForm.value = {
      name: '',
      one_time_run: true,
      cron: '',
      run_at: null
    };
  }
  
  showScheduleOffcanvas.value = true;
}

// Close schedule off-canvas
function closeScheduleOffcanvas() {
  showScheduleOffcanvas.value = false;
  scheduleSubmitting.value = false;
}

// Create schedule via API
async function createSchedule() {
  // Simple validation
  if (!scheduleForm.value.name) {
    toast.warning('Name is required');
    return;
  }
  
  // Ensure type is set based on action
  scheduleForm.value.one_time_run = scheduleAction.value === 'run-later';
  
  if (!scheduleForm.value.one_time_run && !scheduleForm.value.cron) {
    toast.warning('Cron expression is required');
    return;
  }
  
  if (scheduleForm.value.one_time_run && !scheduleForm.value.run_at) {
    toast.warning('Run at date/time is required');
    return;
  }
  
  scheduleSubmitting.value = true;
  
  try {
    // Use the existing formdata which is already modelled by generateJsonOutput
    generateJsonOutput();
    
    const scheduleData = {
      name: scheduleForm.value.name,
      one_time_run: scheduleForm.value.one_time_run,
      form: currentForm.value.name,
      extra_vars: YAML.stringify(formdata.value)
    };
    
    // Add type-specific fields
    if (!scheduleForm.value.one_time_run) {
      scheduleData.cron = scheduleForm.value.cron;
    } else {
      scheduleData.run_at = scheduleForm.value.run_at;
    }
    
    await axios.post('/api/v2/schedule', scheduleData, TokenStorage.getAuthentication());
    
    const successMessage = scheduleAction.value === 'schedule' 
      ? `Schedule "${scheduleForm.value.name}" created successfully`
      : `Job "${scheduleForm.value.name}" scheduled successfully`;
    toast.success(successMessage);
    closeScheduleOffcanvas();
  } catch (error) {
    console.error('Error creating schedule:', error);
    toast.error(error.response?.data?.message || 'Failed to create schedule');
  } finally {
    scheduleSubmitting.value = false;
  }
}

// Store off-canvas functions
function openStoreOffcanvas() {
  // Reset store form
  storeForm.value = {
    name: '',
    description: '',
    expires_at: null
  };
  
  showStoreOffcanvas.value = true;
}

function closeStoreOffcanvas() {
  showStoreOffcanvas.value = false;
  storeSubmitting.value = false;
}

async function createStoredJob() {
  // Simple validation
  if (!storeForm.value.name) {
    toast.warning('Name is required');
    return;
  }

  const ctx = storeCtx.value || buildMainStoreCtx();
  storeSubmitting.value = true;

  try {
    const storedJobData = {
      name: storeForm.value.name,
      description: storeForm.value.description || '',
      form_name: ctx.formName,
      form_data: JSON.stringify(ctx.getData()),
      expires_at: storeForm.value.expires_at || null
    };

    await axios.post('/api/v2/stored-jobs', storedJobData, TokenStorage.getAuthentication());

    toast.success(`Form data saved as "${storeForm.value.name}"`);
    closeStoreOffcanvas();
  } catch (error) {
    console.error('Error storing job:', error);
    if (error.response?.status === 409) {
      toast.error('A saved form with this name already exists');
    } else {
      toast.error(error.response?.data?.message || 'Failed to save form data');
    }
  } finally {
    storeSubmitting.value = false;
  }
}

// Load off-canvas functions
async function openLoadOffcanvas() {
  // If called from the main-form toolbar button there's no active context yet;
  // assume main-form scope.
  if (!storeCtx.value) storeCtx.value = buildMainStoreCtx();
  const ctx = storeCtx.value;
  showLoadOffcanvas.value = true;
  loadSubmitting.value = true;

  try {
    const response = await axios.get(
      `/api/v2/stored-jobs?form_name=${encodeURIComponent(ctx.formName)}`,
      TokenStorage.getAuthentication()
    );
    storedJobs.value = response.data.records || [];
  } catch (error) {
    console.error('Error fetching stored jobs:', error);
    toast.error('Failed to load saved forms');
    storedJobs.value = [];
  } finally {
    loadSubmitting.value = false;
  }
}

function closeLoadOffcanvas() {
  showLoadOffcanvas.value = false;
}

async function loadStoredJob(storedJob) {
  try {
    loadSubmitting.value = true;

    const parsedData = JSON.parse(storedJob.form_data);
    const ctx = storeCtx.value || buildMainStoreCtx();
    ctx.onLoad(parsedData);

    closeLoadOffcanvas();
    toast.success(`Loaded "${storedJob.name}"`);
  } catch (error) {
    console.error('Error loading stored job:', error);
    toast.error('Failed to load form data');
  } finally {
    loadSubmitting.value = false;
  }
}

// Triggered by store / load actions inside a subform's Save dropdown.
// `value` is the current in-progress draft emitted by AppForm so we can
// snapshot partial edits without forcing validation.
function handleSubformAction(entry, { action, value }) {
    storeCtx.value = {
        scope: 'subform',
        formName: entry.subform.name,
        title: entry.subform.description || entry.subform.name,
        getData: () => value,
        onLoad: (parsed) => {
            entry.snapshot = parsed;
            entry.reloadKey = (entry.reloadKey || 0) + 1;
        },
    };
    if (action === 'store') openStoreOffcanvas();
    else if (action === 'load') openLoadOffcanvas();
}

// trigger a job abort
async function abortJob(id) {
  toast.warning("Aborting job " + id);
  try {
    const result = await axios.post(
      `/api/v2/job/${id}/abort`,
      {},
      TokenStorage.getAuthentication()
    );
    if (result.status == 200) {
      abortTriggered.value = true;
    }
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, "Failed to abort job"));
  }
}
// download with axios
async function downloadWithAxios(url, headers) {
  const response = await axios({
    method: "get",
    headers: headers.headers,
    url,
    responseType: "arraybuffer",
  });
  Helpers.forceFileDownload(response);
}
// download a job
async function download(id) {
  try {
    await downloadWithAxios(
      `/api/v2/job/${id}/download`,
      TokenStorage.getAuthentication()
    );
  } catch (err) {
    toast.error(err.toString());
  }
}
// get job output
async function getJob(id, final) {
  try {
    // get the job result
    const result = await axios.get(
      `/api/v2/job/${id}`,
      TokenStorage.getAuthentication()
    );
    // store the job result
    job.value = result.data;
    status.value = job.value.status;
    // multistep and subjobs ?
    if (job.value.job_type == "multistep" && job.value.subjobs.length > 0) {
      const lastsubjob = job.value.subjobs.slice(-1)[0];
      try {
        const subjobresult = await axios.get(
          `/api/v2/job/${lastsubjob}`,
          TokenStorage.getAuthentication()
        );
        subjob.value = subjobresult.data;
      } catch (e) {
        console.error("Error getting job : " + lastsubjob);
      }
    }
    // if the job is not final, we need to keep checking
    if (
      ![
        "success",
        "error",
        "failed",
        "warning",
        "rejected",
        "abandoned",
        "aborted",
      ].includes(status.value)
    ) {
      // try again
      if(status.value == "approve"){
        State.refreshApprovals(); // refresh approvals if needed
      }      
      timeout.value = setTimeout(async () => await getJob(id), 2000);
    } else {
      // the job seems finished
      if (!final) {
        // have we done a final result check?
        // 1 final check
        timeout.value = setTimeout(async () => await getJob(id, true), 2000);
      } else {
        // any frontend actions to do?
        if (currentForm.value.onFinish) {
          currentForm.value.onFinish.forEach((action) => doAction(action, id));
        }
        if (status.value == "success" && currentForm.value.onSuccess) {
          currentForm.value.onSuccess.forEach((action) => doAction(action, id));
        }
        if (status.value == "failed" && currentForm.value.onFailure) {
          currentForm.value.onFailure.forEach((action) => doAction(action, id));
        }
        if (status.value == "aborted" && currentForm.value.onAbort) {
          currentForm.value.onAbort.forEach((action) => doAction(action, id));
        }
        abortTriggered.value = false;
        message.value = Helpers.getJobMessageByStatus(status.value);
        if (status.value == "success") {
          toast.success(message.value);
        } else if (status.value == "failed") {
          toast.error(message.value);
        } else {
          toast.warning(message.value);
        }
        clearTimeout(timeout.value);
        State.refreshApprovals(); // refresh approvals if needed
      }
    }
  } catch (err) {
    console.log("error getting job " + err.toString());
    toast.error("Failed to get job");

    if (err.response.status != 401) {
      message.value = "Error in axios call to get job\n\n" + err.toString();
      status.value = "error";
    }
  }
}

// execute the form
async function launchForm(postdata) {
  message.value = "Connecting with job api ";
  status.value = "";
  try {
    status.value = "running";
    const result = await axios.post(
      `/api/v2/job/`,
      postdata,
      TokenStorage.getAuthentication()
    );
    jobId.value = result.data.id;
    if (currentForm.value.onSubmit) {
      currentForm.value.onSubmit.forEach((action) => {
        doAction(action, jobId.value);
      });
    }
    timeout.value = setTimeout(async () => await getJob(jobId.value), 2000);
  } catch (err) {
    status.value = "failed";
    toast.error(
      Helpers.parseAxiosResponseError(err, "Failed to invoke job launch")
    );
    if (err.response?.status != 401) {
      resetResult();
    }
  }
  pauseJsonOutput.value = false;
}

async function loadForm(){
  const formName = route.query.form ? decodeURIComponent(route.query.form) : undefined;
  if (!formName) {
    console.error("No form name provided in the URL");
    formNotFound.value = true;
    return;
  }
  formConfig.value = await Form.load(formName);
  if (formConfig.value.forms.length == 0) {
    console.error("No forms found in the configuration for form: " + formName);
    formNotFound.value = true;
    return;
  } else {
    // Check for pre-fill data from query params BEFORE setting currentForm
    initialFormData.value = {};
    if (route.query.prefillJobId) {
      try {
        console.log('Loading pre-fill data from job:', route.query.prefillJobId);
        const result = await axios.get(
          `/api/v2/job/${route.query.prefillJobId}/rawformdata`,
          TokenStorage.getAuthentication()
        );
        if (result.data) {
          initialFormData.value = result.data;
          toast.info(`Form pre-filled with data from previous job #${route.query.prefillJobId}`);
        } else {
          console.log('No data in result:', result.data);
        }
      } catch (err) {
        console.error('Failed to load pre-fill data:', err);
        
        let errorMessage = 'Failed to load previous job data';
        if (err.response?.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.response?.status === 404) {
          errorMessage = 'Previous job data not found or no longer available';
        } else if (err.response?.status === 403) {
          errorMessage = 'You do not have permission to relaunch jobs';
        } else if (err.response?.status === 400) {
          errorMessage = err.response.data?.error || 'Cannot load data: form mismatch';
        }
        
        toast.error(errorMessage);
      }
    }

    // Now set currentForm which will trigger component rendering
    currentForm.value = formConfig.value.forms[0];
    formLoaded.value = true;
    constants.value = formConfig.value.constants;
    // Shallow merge form vars into constants to prevent prototype pollution
    constants.value = Object.assign({}, constants.value, formConfig.value.forms[0].vars || {});
    

    // see if the help should be show initially
    if (currentForm.value?.showHelp && currentForm.value.showHelp === true) {
      showHelp.value = true;
    }
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) {
    return;
  }
  await loadForm();
  resetResult();
});

// Watch for route changes to reload form when navigating with different query params
watch(() => route.query.form, async (newForm, oldForm) => {
  if (newForm && newForm !== oldForm) {
    console.log('Form query parameter changed, reloading form:', newForm);
    await reloadForm();
  }
});

onBeforeUnmount(() => {
  clearTimeout(timeout.value);
});
</script>

<template>
  <AppNav />
  <div class="flex-shrink-0">
    <main class="d-flex container-xxl" :class="{'d-none':hideForm}">
      <div v-if="authenticated && currentForm" class="container-fluid pt-5">
        <!-- BREADCRUMBS (only when editing a subform) -->
        <nav v-if="activeEntry" aria-label="breadcrumb">
          <ol class="breadcrumb mb-2">
            <li class="breadcrumb-item">{{ currentForm.name }}</li>
            <li v-for="e in editStack.slice(0, -1)" :key="'crumb-' + e.id"
                class="breadcrumb-item">{{ e.title }}</li>
            <li class="breadcrumb-item active fw-bold" aria-current="page">{{ activeEntry.title }}</li>
          </ol>
        </nav>

        <!-- TITLE: main form title, replaced by subform title while editing -->
        <h2 class="d-flex align-items-center">
          <template v-if="activeEntry">
            {{ activeEntry.subtitle || activeEntry.title }}
            <BsButton v-if="activeEntry.subform?.help" cssClass="btn-sm ms-3 fw-normal"
              cssClassToggle="btn-sm ms-3 fw-normal"
              icon="question-circle" iconToggle="question-circle"
              :toggle="activeEntry.showHelp" @click="activeEntry.showHelp = !activeEntry.showHelp">
              Show help
              <template #toggle>Hide help</template>
            </BsButton>
          </template>
          <template v-else>
            {{ currentForm.name }}
            <BsButton v-if="currentForm.help" cssClass="btn-sm ms-3 fw-normal" cssClassToggle="btn-sm ms-3 fw-normal"
              icon="question-circle" iconToggle="question-circle" :toggle="showHelp" @click="showHelp = !showHelp">
              Show help
              <template #toggle>Hide help</template>
            </BsButton>
          </template>
        </h2>

        <!-- HELP -->
        <div v-if="activeEntry && activeEntry.subform?.help && activeEntry.showHelp"
             class="alert alert-light" role="alert">
          <vue-showdown :markdown="activeEntry.subform.help" flavor="github" :options="{ ghCodeBlocks: true }" />
        </div>
        <div v-else-if="!activeEntry && currentForm.help && showHelp" class="alert alert-light" role="alert">
          <vue-showdown :markdown="currentForm.help" flavor="github" :options="{ ghCodeBlocks: true }" />
        </div>
        <div class="row">
          <div class="col">
            <!-- MAIN FORM: mounted always, hidden while editing a subform -->
            <AppForm v-show="!activeEntry" :key="key" @change="formChanged" :currentForm="currentForm"
              :constants="constants" :showExtraVars="showExtraVars" :fileProgress="fileProgress"
              :initialData="initialFormData" v-model="form"
              :subforms="currentForm?.subforms || []"
              v-model:status="status" @submit-action="handleSubmitAction">
              <!-- TOOL BAR BUTTONS -->
              <template #toolbarbuttons>
                <!-- DEBUG BUTTONS -->
                <BsButton v-if="store.profile.options?.showExtraVars" cssClass="btn-sm me-3 fw-normal"
                  cssClassToggle="btn-sm me-3 fw-normal" icon="eye" iconToggle="eye-slash" :toggle="showExtraVars"
                  @click="toggleShowExtraVars()">Show Extravars<template #toggle>Hide Extravars</template>
                </BsButton>
                <BsButton cssClass="btn-sm me-3 fw-normal" icon="redo" @click="reloadForm">
                  Reload this form
                </BsButton>
                <BsButton v-if="store.profile.options?.allowStoredJobs" cssClass="btn-sm me-3 fw-normal"
                  icon="file-import" @click="storeCtx = buildMainStoreCtx(); openLoadOffcanvas()">
                  Load from Store
                </BsButton>

                <!-- enable verbose logging -->
                <BsInputCheckboxRaw v-if="store.profile.options?.allowVerboseMode" v-model="enableVerbose"
                  :label="'verbose'" v-show="!hideForm" cssClass="ms-2 d-inline-block" />
              </template>
            </AppForm>

            <!-- SUBFORMS: one AppForm per stacked edit, only the deepest is visible. -->
            <!-- Kept mounted (v-show) so draft state survives when going deeper and back. -->
            <template v-for="(entry, i) in editStack" :key="entry.id + ':' + (entry.reloadKey || 0)">
              <AppForm v-show="i === editStack.length - 1"
                mode="subform"
                :currentForm="entry.subform"
                :constants="constants"
                :subforms="currentForm?.subforms || []"
                :initialData="entry.snapshot"
                v-model="entry.draft"
                @save="(val) => saveEdit(entry.id, val)"
                @cancel="popEdit(entry.id)"
                @submit-action="(e) => handleSubformAction(entry, e)">
                <template #toolbarbuttons>
                  <BsButton cssClass="btn-sm me-3 fw-normal" icon="arrow-left" @click="popEdit(entry.id)">
                    Back
                  </BsButton>
                  <BsButton v-if="store.profile.options?.allowStoredJobs"
                    cssClass="btn-sm me-3 fw-normal" icon="file-import"
                    @click="handleSubformAction(entry, { action: 'load', value: entry.draft })">
                    Load from Store
                  </BsButton>
                  <BsButton v-if="store.profile.options?.showExtraVars"
                    cssClass="btn-sm me-3 fw-normal" cssClassToggle="btn-sm me-3 fw-normal"
                    icon="eye" iconToggle="eye-slash" :toggle="showExtraVars"
                    @click="toggleShowExtraVars()">
                    Show Output<template #toggle>Hide Output</template>
                  </BsButton>
                </template>
              </AppForm>
            </template>
          </div>
          <div class="col-4" v-if="showExtraVars">
            <div class="d-flex justify-content-between">
              <div>
                <small v-if="activeEntry" class="text-muted fst-italic me-2">
                  {{ displayedOutputTitle }}
                </small>
                <BsButton cssClass="btn-sm" cssClassToggle="btn-sm" :toggle="viewAsYaml"
                  @click="viewAsYaml = !viewAsYaml">
                  <template #default>View as YAML</template>
                  <template #toggle>View as JSON</template>
                </BsButton>
              </div>
              <!-- TOOLBAR ICONS-->
              <div>
                <span class="ms-2" role="button" title="Copy ExtraVars" @click="clip(displayedOutput, false, viewAsYaml)">
                  <font-awesome-icon icon="copy" class="text-primary" />
                </span>
              </div>
            </div>
            <div class="mt-4 p-3 card" v-if="!viewAsYaml">
              <VueJsonPretty :data="displayedOutput" />
            </div>
            <div class="mt-4 p-3 card" v-else>
              <pre v-highlightjs><code language="yaml" style="border:none;padding:0">{{ displayedOutputYaml }}</code></pre>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="!formNotFound" class="loader mx-auto">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      <div v-else class="alert alert-danger mt-5" role="alert">
        <h4 class="alert-heading">Form not found</h4>
        <p>
          The requested form could not be found. Please check the form name in
          the URL or contact your administrator.
        </p>
      </div>
    </main>
  </div>

  <div class="flex-shrink-0" v-if="status != ''">
    <main class="d-flex container-xxl">
      <div class="container-fluid py-3">
        <div class="row my-3">
          <div class="col">
            <div class="d-grid">
              <button type="button" class="btn text-white" :class="'btn-' + formStatus.color" @click="resetResult()"
                :disabled="formStatus.disabled">
                <FaIcon :icon="formStatus.icon"></FaIcon><span class="ms-3">{{ formStatus.label }}</span>
              </button>
            </div>
          </div>
          <div class="col" v-if="
            formStatus.abort &&
            !abortTriggered &&
            (currentForm.abortable || true)
          ">
            <div class="d-grid">
              <button type="button" class="btn btn-danger text-white" @click="abortJob(jobId)">
                <FaIcon icon="stop"></FaIcon><span class="ms-3">Abort</span>
              </button>
            </div>
          </div>
        </div>
        <BsButton v-if="status != ''" icon="filter" cssClass="btn-sm mb-3" cssClassToggle="btn-sm mb-3"
          iconToggle="filter-circle-xmark" :toggle="filterOutput" @click="filterOutput = !filterOutput">
          <template #default>Apply filter</template>
          <template #toggle>Remove filter</template>
        </BsButton>
        <div class="row">
          <div class="col">
            <AppAnsibleOutput :output="filteredJobOutput" :jobLog="job.job_log">
              <template #title>
                <h3 v-if="job.job_type == 'multistep' && subjob?.output">
                  Main job (jobid {{ job.id }})
                  <sup><span class="badge rounded-pill status" :class="Helpers.getColorClassByStatus(job.status,'bg')">{{ job.status }}</span></sup>
                </h3>
              </template>
            </AppAnsibleOutput>
          </div>
          <div class="col" v-if="subjob.output">
            <AppAnsibleOutput :output="filteredSubJobOutput" :jobLog="subjob.job_log">
              <template #title>
                <h3>
                  Current Step (jobid {{ subjob.id }})
                  <sup><span class="badge rounded-pill status" :class="Helpers.getColorClassByStatus(subjob.status,'bg')">{{ subjob.status
                      }}</span></sup>
                </h3>
              </template>
            </AppAnsibleOutput>
          </div>
        </div>

        <BsButton v-if="status != 'executing'" icon="rotate-right" @click="resetResult()">Close output</BsButton>
        <BsButton v-if="status != 'executing'" cssClass="ms-3" icon="download" @click="download(jobId)">Download output
        </BsButton>
      </div>
    </main>
  </div>
  
  <!-- SCHEDULE OFF-CANVAS -->
  <BsOffCanvas 
    :show="showScheduleOffcanvas" 
    :title="scheduleAction === 'schedule' ? 'Create Schedule' : 'Run Later'"
    :icon="scheduleAction === 'schedule' ? 'calendar-plus' : 'clock'"
    @close="closeScheduleOffcanvas">
    <template #default>
      <div class="mb-3">
        <label class="form-label">Name <span class="text-danger">*</span></label>
        <input 
          type="text" 
          class="form-control" 
          v-model="scheduleForm.name"
          :placeholder="scheduleAction === 'schedule' ? 'e.g., Daily Backup' : 'e.g., Maintenance Window'"
          :disabled="scheduleSubmitting"
        />
        <small class="form-text text-muted">A descriptive name for this {{ scheduleAction === 'schedule' ? 'schedule' : 'job' }}</small>
      </div>
      
      <div class="mb-3" v-if="scheduleAction === 'schedule'">
        <label class="form-label">Cron Expression <span class="text-danger">*</span></label>
        <input 
          type="text" 
          class="form-control font-monospace" 
          v-model="scheduleForm.cron"
          placeholder="0 0 * * *"
          :disabled="scheduleSubmitting"
        />
        <small class="form-text text-muted">
          Examples:<br>
          <code>0 0 * * *</code> - Daily at midnight<br>
          <code>0 */6 * * *</code> - Every 6 hours<br>
          <code>0 9 * * 1-5</code> - Weekdays at 9am
        </small>
      </div>
      
      <div class="mb-3" v-if="scheduleAction === 'run-later'">
        <label class="form-label">Run At <span class="text-danger">*</span></label>
        <VueDatePicker 
          v-model="scheduleForm.run_at"
          :disabled="scheduleSubmitting"
        />
        <small class="form-text text-muted">Select the date and time to run this job once</small>
      </div>
    </template>
    <template #actions>
      <button 
        class="btn btn-primary" 
        @click="createSchedule"
        :disabled="scheduleSubmitting">
        <FaIcon :icon="scheduleSubmitting ? 'spinner' : 'save'" :spin="scheduleSubmitting" />
        <span class="ms-2">{{ scheduleSubmitting ? 'Creating...' : (scheduleAction === 'schedule' ? 'Create Schedule' : 'Schedule Job') }}</span>
      </button>
    </template>
  </BsOffCanvas>

  <!-- STORE OFF-CANVAS -->
  <BsOffCanvas 
    :show="showStoreOffcanvas" 
    :title="storeCtx ? `Save ${storeCtx.title}` : 'Save Form Data'"
    icon="file-export"
    @close="closeStoreOffcanvas">
    <template #default>
      <div class="mb-3">
        <label class="form-label">Name <span class="text-danger">*</span></label>
        <input 
          type="text" 
          class="form-control" 
          v-model="storeForm.name"
          placeholder="e.g., Production Config"
          :disabled="storeSubmitting"
        />
        <small class="form-text text-muted">A unique name for this saved form</small>
      </div>
      
      <div class="mb-3">
        <label class="form-label">Description</label>
        <textarea 
          class="form-control" 
          rows="3"
          v-model="storeForm.description"
          placeholder="Optional description"
          :disabled="storeSubmitting"
        />
      </div>
      
      <div class="mb-3">
        <label class="form-label">Expires At (Optional)</label>
        <VueDatePicker 
          v-model="storeForm.expires_at"
          :disabled="storeSubmitting"
        />
        <small class="form-text text-muted">Leave blank to never expire</small>
      </div>
    </template>
    <template #actions>
      <button 
        class="btn btn-primary" 
        @click="createStoredJob"
        :disabled="storeSubmitting">
        <FaIcon :icon="storeSubmitting ? 'spinner' : 'save'" :spin="storeSubmitting" />
        <span class="ms-2">{{ storeSubmitting ? 'Saving...' : 'Save' }}</span>
      </button>
    </template>
  </BsOffCanvas>

  <!-- LOAD OFF-CANVAS -->
  <BsOffCanvas 
    :show="showLoadOffcanvas" 
    :title="storeCtx ? `Load ${storeCtx.title}` : 'Load Saved Form'"
    icon="file-import"
    @close="closeLoadOffcanvas">
    <template #default>
      <div v-if="loadSubmitting" class="text-center py-4">
        <FaIcon icon="spinner" spin size="2x" />
        <p class="mt-2">Loading saved forms...</p>
      </div>
      
      <div v-else-if="storedJobs.length === 0" class="text-center py-4 text-muted">
        <FaIcon icon="inbox" size="3x" class="mb-3" />
        <p>No saved forms found</p>
      </div>
      
      <div v-else class="list-group">
        <a 
          v-for="job in storedJobs" 
          :key="job.id"
          href="#"
          class="list-group-item list-group-item-action"
          @click.prevent="loadStoredJob(job)">
          <div class="d-flex w-100 justify-content-between align-items-start">
            <div>
              <h6 class="mb-1">{{ job.name }}</h6>
              <p v-if="job.description" class="mb-1 small text-muted">{{ job.description }}</p>
              <small class="text-muted">
                Created: {{ new Date(job.created_at).toLocaleString() }}
                <span v-if="job.expires_at"> • Expires: {{ new Date(job.expires_at).toLocaleString() }}</span>
              </small>
            </div>
          </div>
        </a>
      </div>
    </template>
  </BsOffCanvas>
</template>
<style scoped lang="scss">
*:has(.loader) {
  display: flex-columns;
  justify-content: center;
  align-items: center;
  margin: auto;
}

.status {
  font-size: 0.75rem;
}

</style>
