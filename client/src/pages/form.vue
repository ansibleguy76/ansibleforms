<script setup>
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
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

// use
const route = useRoute();
const router = useRouter();
const toast = useToast();
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

/******************************** */
// computed
/******************************** */

// calculated formdata as yaml
const formdataYaml = computed(() => YAML.stringify(formdata.value));

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
                  if (master[obj] === undefined) {
                    master[obj] = {};
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
  postdata.rawFormData = {};
  currentForm.value.fields.forEach((field) => {
    const fieldName = field.name;
    
    // Skip if field value not in form
    if (!(fieldName in form.value)) return;
    
    // Skip constants (loaded from config, not user input)
    if (field.type === 'constant') return;
    
    // Skip password fields for security
    if (field.type === 'password') return;
    
    // Include this field
    postdata.rawFormData[fieldName] = form.value[fieldName];
  });
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
  status.value = "";
  message.value = "";
  error.value = "";
  subjob.value = {};
  job.value = {};
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
  const formName = route.query.form;
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
        <!-- TITLE -->
        <h2 class="d-flex align-items-center">
          {{ currentForm.name }}
          <BsButton v-if="currentForm.help" cssClass="btn-sm ms-3 fw-normal" cssClassToggle="btn-sm ms-3 fw-normal"
            icon="question-circle" iconToggle="question-circle" :toggle="showHelp" @click="showHelp = !showHelp">
            Show help
            <template #toggle>Hide help</template>
          </BsButton>
        </h2>

        <!-- HELP -->
        <div v-if="currentForm.help && showHelp" class="alert alert-light" role="alert">
          <vue-showdown :markdown="currentForm.help" flavor="github" :options="{ ghCodeBlocks: true }" />
        </div>
        <div class="row">
          <div class="col">
            <AppForm :key="key" @change="formChanged" :currentForm="currentForm"
              :constants="constants" :showExtraVars="showExtraVars" :fileProgress="fileProgress" 
              :initialData="initialFormData" v-model="form"
              v-model:status="status" @submit="submitForm">
              <!-- TOOL BAR BUTTONS -->
              <template #toolbarbuttons>
                <!-- DEBUG BUTTONS -->
                <BsButton v-if="store.profile.options?.showExtraVars ?? true" cssClass="btn-sm me-3 fw-normal"
                  cssClassToggle="btn-sm me-3 fw-normal" icon="eye" iconToggle="eye-slash" :toggle="showExtraVars"
                  @click="toggleShowExtraVars()">Show Extravars<template #toggle>Hide Extravars</template>
                </BsButton>
                <BsButton cssClass="btn-sm me-3 fw-normal" icon="redo" @click="reloadForm">
                  Reload this form
                </BsButton>

                <!-- enable verbose logging -->
                <BsInputCheckboxRaw v-model="enableVerbose" :label="'verbose'" v-show="!hideForm"
                  cssClass="ms-2 d-inline-block" />

              </template>
            </AppForm>
          </div>
          <div class="col-4" v-if="showExtraVars">
            <div class="d-flex justify-content-between">
              <div>
                <BsButton cssClass="btn-sm" cssClassToggle="btn-sm" :toggle="viewAsYaml"
                  @click="viewAsYaml = !viewAsYaml">
                  <template #default>View as YAML</template>
                  <template #toggle>View as JSON</template>
                </BsButton>
              </div>
              <!-- TOOLBAR ICONS-->
              <div>
                <span class="ms-2" role="button" title="Copy ExtraVars" @click="clip(formdata, false, viewAsYaml)">
                  <font-awesome-icon icon="copy" class="text-primary" />
                </span>
              </div>
            </div>
            <div class="mt-4 p-3 card" v-if="!viewAsYaml">
              <VueJsonPretty :data="formdata" />
            </div>
            <div class="mt-4 p-3 card" v-else>
              <pre v-highlightjs><code language="yaml" style="border:none;padding:0">{{ formdataYaml }}</code></pre>
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
            <AppAnsibleOutput :output="filteredJobOutput">
              <template #title>
                <h3 v-if="job.job_type == 'multistep' && subjob?.output">
                  Main job (jobid {{ job.id }})
                  <sup><span class="badge rounded-pill status" :class="Helpers.getColorClassByStatus(job.status,'bg')">{{ job.status }}</span></sup>
                </h3>
              </template>
            </AppAnsibleOutput>
          </div>
          <div class="col" v-if="subjob.output">
            <AppAnsibleOutput :output="filteredSubJobOutput">
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
