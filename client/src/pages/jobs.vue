<script setup>
    import { ref, onMounted, computed, watch } from 'vue';
    import { useToast } from 'vue-toastification';
    import { useRoute, useRouter } from 'vue-router';
    import { useAppStore } from "@/stores/app";
    import axios from 'axios';
    import TokenStorage from '@/lib/TokenStorage';
    import State from "@/lib/State";        
    import Helpers from '@/lib/Helpers';
    import dayjs from 'dayjs';
    import utc from 'dayjs/plugin/utc';
    import YAML from 'yaml';

    // INIT

    const toast = useToast();
    const router = useRouter();
    const route = useRoute();
    const store = useAppStore();
    dayjs.extend(utc)

    // DATA

    const jobs = ref([]);
    const job = ref(null);
    const isLoading = ref(false);
    const lines = ref(1000);
    const jobId = ref(null);
    const filter = ref(null);
    const displayedJobs = ref([]);
    const showExtraVars = ref(false);
    const showArtifacts = ref(false);
    const viewAsYaml = ref(false);
    const approvalMessage = ref(null);
    const approvalTitle = ref(null);
    const hide = ref(false);
    const collapsed = ref({});
    const showDelete = ref(false);
    const showAbort = ref(false);
    const showRelaunch = ref(false);
    const showApprove = ref(false);
    const runningJobsInterval = ref(null);
    const showReject = ref(false);
    const relaunchVerbose = ref(false);
    const relaunchWithEdit = ref(false);
    const tempJobId = ref(null);
    const noOfRecords = ref(500);

    // COMPUTED

    // Check if user can relaunch jobs
    const canRelaunchJobs = computed(() => {
        return store?.profile?.options?.allowJobRelaunch ?? store.isAdmin;
    });

    // job output filtered
    const filteredJobOutput = computed(() => {
        if(!hide.value) return job.value?.output?.replace(/\r\n/g,"<br>") || ""
        return job.value?.output?.replace(/<span class='low[^<]*<\/span>/g,"").replace(/\r\n/g,"<br>").replace(/(<br>\s*){3,}/ig,"<br><br>") || "" // eslint-disable-line
    })
    // subjob output filtered
    const filteredSubJobOutput = computed(() => {
        if(!hide.value) return subjob.value?.output?.replace(/\r\n/g,"<br>") || ""
        return subjob.value?.output?.replace(/<span class='low[^<]*<\/span>/g,"").replace(/\r\n/g,"<br>").replace(/(<br>\s*){3,}/ig,"<br><br>") || "" // eslint-disable-line
    })
    // current job index (array based)
    const displayedJobIndex = computed(() => {
        if(jobId.value){
            return jobs.value.map((e)=>e.id).indexOf(jobId.value);
        }else {
            return -1
        }
    })
    // main jobs
    const parentJobs = computed(() => {
        if(filter.value){
            return jobs.value?.filter(x => !x.parent_id
                &&
                (
                    x.id?.toString().match(filter.value) ||
                    x.status?.match(filter.value) ||
                    x.form?.match(filter.value)  ||
                    x.job_type?.match(filter.value) ||
                    x.start?.match(filter.value) ||
                    x.end?.match(filter.value) ||
                    x.user?.match(filter.value)
                )
            )
        }else{
            return jobs.value?.filter(x => !x.parent_id)
        }
    })
    // subjobs
    const subjobs = computed(() => {
        return job.value?.subjobs || []
    })
    // all jobs that are running
    const runningJobs = computed(() => {
        return jobs.value?.filter(x => (x.start && dayjs().diff(x.start,'hours')<6) && (x.status=="running" || x.abort_requested))
    })
    // the last subjob id
    const subjobId = computed(() => {
        return subjobs.value.slice(-1)[0]
    })
    // current subjob, if any
    const subjob = computed(() => {
        return jobs.value?.filter(x=>x.id==subjobId.value)[0] || null
    })

    // WATCHERS

    // watch route changes, get job id and load the output
    watch(() => route.params.id, async (id) => {
        if(id){
            jobId.value=id
            await loadOutput(id)
            // Expand parent if this is a child job
            const selectedJob = jobs.value.find(j => j.id == id);
            if (selectedJob && selectedJob.parent_id) {
                collapsed.value[selectedJob.parent_id] = true;
            }
        }
    });

    // persist lines when user changes the select; also reload jobs
    watch(lines, async (val, oldVal) => {
        try{
            Helpers.setCookie('jobs_lines', String(val), 365);
        }catch(e){}
        if (val !== oldVal) {
            await loadJobs();
        }
    });

    // METHODS

    // copy string to clipboard
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
                document.execCommand('copy');
            } catch (error) {
                console.error(error);
            } finally {
                textArea.remove();
            }
        }
    }

    // copy object to clipboard as json or yaml
    async function clip(v, doNotStringify = false, asYaml = false) {
        if (doNotStringify) {
        try{
            await copyToClipboard(v)
            toast.success("Copied to clipboard");
        }catch(err){
            toast.error("Error copying to clipboard : \n" + err.toString());
        }
        } else {
        try{
            if(asYaml){
            await copyToClipboard(YAML.stringify(v))
            }else{
            await copyToClipboard(JSON.stringify(v,null,2))
            }
            toast.success("Copied to clipboard");
        }catch(err){
            toast.error("Error copying to clipboard : \n" + err.toString());
        }
        }
    }
    // load jobs
    async function loadJobs() {
        if (!isLoading.value) {
            try {
                isLoading.value = true;
                const result = await axios.get(`/api/v2/job?records=${lines.value}`, TokenStorage.getAuthentication());
                if (result.status === 200) {
                    jobs.value = result.data.records;
                    if (jobId.value) {
                        await loadOutput(jobId.value);
                    }
                } else {
                    toast.error(result.data.error);
                } 
            } catch (err) {
                if (err.response && err.response.data && err.response.data.error) {
                    toast.error(err.response.data.error);
                } else {
                    toast.error("Failed to load jobs");
                }
            } finally {
                isLoading.value = false;
                State.refreshApprovals();
            }
        }
    }
    // get child jobs by parent id
    function childJobs(id){
        if(!isLoading.value){
            return jobs.value.filter(x=> (x.parent_id===id && (collapsed.value[id] ?? false))).sort((a, b) => a.id > b.id && 1 || -1)
        } else {
            return []
        }
    }    

    // load job output
    async function loadOutput(id, sub=false){
        if (!id) {
            job.value = null;
            return;
        }
        if(!sub){
            jobId.value=id
        }
        const result = await axios.get(`/api/v2/job/${id}`, TokenStorage.getAuthentication());
        if (result.status === 200) {
            const data = result.data;
            if (!sub) {
                job.value = data;
                if (subjobId.value) {
                    await loadOutput(subjobId.value, true);
                }
            } else {
                const idx = getJobIndex(id);
                jobs.value[idx] = data;
            }
        } else {
            toast.error(result.data?.error || "Failed to load job output");
        }
    }
    // load running jobs
    async function loadRunningJobs(){
        // using await
        for (const item of runningJobs.value) {
            const result = await axios.get(`/api/v2/job/${item.id}`,TokenStorage.getAuthentication())
            if(result.status==200 && noOfRecords.value!=result.data.no_of_records){
                await loadJobs() // no of records changed ; reload jobs
                noOfRecords.value=result.data.no_of_records
                return; // Exit early - loadJobs() has refreshed everything
            }
            const idx = getJobIndex(item.id)
            if(idx !== -1) {
                jobs.value[idx]=result.data
            }
            if(item.id==jobId.value){
                job.value=result.data
            }
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
            await downloadWithAxios(`/api/v2/job/${id}/download`,TokenStorage.getAuthentication());
        } catch (err) {
            toast.error(err.toString());
        }
    }
    // display a subset of jobs (by pagination)
    function setDisplayJobs(jobs){
        displayedJobs.value=jobs
    }
    // format time
    function formatTime(t){
        // preserve zone/offset sent by backend and do not convert to client local time
        if(!t) return '';

        return dayjs.utc(t).format('YYYY-MM-DD HH:mm:ss');
    }
    // get job index by id
    function getJobIndex(id){
        return jobs.value.findIndex(x=>x.id===id)
    }
    // show approval (approve or reject)
    async function showApproval(id,reject){
        try{
            jobId.value=id
            const result = await axios.get(`/api/v2/job/${id}`,TokenStorage.getAuthentication())
            if(result.status === 200){
                job.value = result.data;
                approvalMessage.value = replacePlaceholders(job.value.approval?.message || "");
                approvalTitle.value = replacePlaceholders(job.value.approval?.title) || "Approve";
                if (reject) {
                    showReject.value = true;
                } else {
                    showApprove.value = true;
                }
            } else {
                toast.error(result.data?.error || "Failed to get job output");
            }
        }catch(err){
            toast.error(`Failed to get job output: ${err.toString()}`);
        }
    }
    // replace placeholders in a string  
    function replacePlaceholders(msg){
        if(!msg){
            return ""
        }
        console.log("Replacing placeholders in message:", msg);
        console.log("Job extravars:", job.value.extravars);

        return msg.replace(
            /\$\(([^\)]+)\)/g, // eslint-disable-line
            (placeholderWithDelimiters, placeholderWithoutDelimiters) =>
            findExtravar(job.value.extravars,placeholderWithoutDelimiters) || placeholderWithDelimiters
        );
    }
    // find extravars
    function findExtravar(data,expr){
        var outputValue=""
        expr.split(/\s*\.\s*/).reduce((master,obj, level,arr) => {
            if (level === (arr.length - 1)){
                try{
                    outputValue=master[obj]
                }catch(err){
                    outputValue="/bad placeholder/"
                }
            }else{
                outputValue=master
            }
            return master[obj]
        },data);
        return outputValue;
    }
    async function jobAction(id,action,method="post",uri_suffix=""){
        try{
            jobId.value=id
            var result
            const uri = `/api/v2/job/${id}${uri_suffix}`;
            switch(method){
                case 'get':
                    result = await axios.get(uri,TokenStorage.getAuthentication())
                    break;
                case 'post':
                    result = await axios.post(uri,{},TokenStorage.getAuthentication())
                    break;
                case 'delete':
                    result = await axios.delete(uri,TokenStorage.getAuthentication())
                    id = undefined // reset id after delete
                    jobId.value=undefined
                    break;
                case 'patch':
                    result = await axios.patch(uri,{},TokenStorage.getAuthentication())
                    break;
                default:
                    throw new Error("Invalid method");
            }
            if(result.status==200){
                toast.success(result.data.message || `Job ${id} ${action}ed successfully`);
                await loadJobs()
                // If relaunch, navigate to the new job
                if(action === 'relaunch' && result.data.id){
                    getJob(result.data.id);
                } else {
                    await loadOutput(id);
                }
                tempJobId.value=undefined
            }else{
                toast.error(result.data.message || `Failed to ${action} job ${id}`);
            }
        }catch(err){
            toast.error(Helpers.parseAxiosResponseError(err) || `Failed to ${action} job ${id}`);
        }finally{
            await loadJobs()
        }   
    }
    // delete a job
    async function deleteJob(id){
        await jobAction(id, 'delete', 'delete');
    }
    // abort a job
    async function abortJob(id){
        await jobAction(id, 'abort', 'post', '/abort');
    }
    // relaunch a job (direct relaunch)
    async function relaunchJob(id, verbose=false){
        relaunchVerbose.value=false
        await jobAction(id, 'relaunch', 'post', `/relaunch?verbose=${verbose}`);
    }
    // edit and relaunch - navigate to form with pre-filled data
    async function editAndRelaunchJob(id){
        relaunchWithEdit.value=false
        // Get the job to find the form name
        try {
            const result = await axios.get(`/api/v2/job/${id}`, TokenStorage.getAuthentication());
            const formName = result.data.form;
            // Navigate to form with prefillJobId parameter
            router.push({ name: '/form', query: { form: formName, prefillJobId: id } });
            showRelaunch.value = false;
        } catch(err) {
            toast.error('Failed to load job data: ' + err.toString());
        }
    }
    // approve a job
    async function approveJob(id){
        await jobAction(id, 'approve', 'post', '/approve');
        State.refreshApprovals(); // refresh approvals before approving        
    }
    // reject a job
    async function rejectJob(id){
        await jobAction(id, 'reject', 'post', '/reject');
    }
    // get job by id - navigation
    function getJob(id){
        router.push({ name:'/jobs/:id', params: { id } }).catch((e)=>{})
    }
    // check if approval is allowed for a job
    function approvalAllowed(job){
        if(store.profile?.roles?.includes("admin"))return true
        if(!job.approval)return true
        // not admin and approval - lets check access
        var approval=JSON.parse(job.approval)
        var access = approval?.roles?.filter(role => store.profile?.roles?.includes(role))
        if(access?.length>0){
          return true
        }else {
          return false
        }        
    }
    // keep track of collapsed multistep jobs
    function toggleCollapse(id){
        if(!collapsed.value[id]){
            collapsed.value[id]=true
        }else{
            collapsed.value[id]=false
        }
    }
    // job background color
    function jobBackground(job){
        if(job.id==jobId.value)return 'table-selected'
        return Helpers.getColorClassByStatus(job.status,'table')
    }

    // EVENTS

    // mounted
    onMounted(async () => {
        // restore lines per-page from cookie if present
        try{
            const savedLines = Helpers.getCookie('jobs_lines');
            if (savedLines && !isNaN(parseInt(savedLines))) {
                lines.value = parseInt(savedLines);
            }
        }catch(e){}


        if(route.params.id){
            jobId.value=parseInt(route.params.id)
            await loadOutput(jobId.value)
        }
        await loadJobs(true);
        // After jobs are loaded, expand parent if jobId is a child job
        if (jobId.value) {
            const selectedJob = jobs.value.find(j => j.id == jobId.value);
            if (selectedJob && selectedJob.parent_id) {
                collapsed.value[selectedJob.parent_id] = true;
            }
        }
        runningJobsInterval.value = setInterval(loadRunningJobs, 5000);
    });
    // destroy
    onBeforeUnmount(() => {
        clearInterval(runningJobsInterval.value);
    })

</script>
<template>
  <AppNav />    
  <div class="flex-shrink-0">
    <!-- Modal - delete verify -->
    <BsModal v-if="showDelete" @close="showDelete=false">
        <template #title> Delete job {{ tempJobId }} </template>
        <template #default><p class="mt-3 fs-6 user-select-none">Are you sure you want to delete job <strong>{{ tempJobId }}</strong>?</p></template>
        <template #footer><BsButton icon="trash" @click="deleteJob(tempJobId);showDelete=false">Delete</BsButton></template>
    </BsModal>    
    <!-- Modal - abort verify -->
    <BsModal v-if="showAbort" @close="showAbort=false">
        <template #title> Abort job {{ tempJobId }} </template>
        <template #default><p class="mt-3 fs-6 user-select-none">Are you sure you want to abort job <strong>{{ tempJobId }}</strong>?</p></template>
        <template #footer><BsButton icon="ban" @click="abortJob(tempJobId);showAbort=false">Abort</BsButton></template>
    </BsModal>
    <!-- Modal - relaunch verify -->
    <BsModal v-if="showRelaunch" @close="showRelaunch=false">
        <template #title> Relaunch job {{ tempJobId }} </template>
        <template #default>
            <p class="mt-3 fs-6 user-select-none">Choose how to relaunch job <strong>{{ tempJobId }}</strong>:</p>
            <BsCheckbox v-model="relaunchVerbose" label="Verbose mode" class="mt-2" :isSwitch="true" :inline="true" />
            <BsCheckbox v-model="relaunchWithEdit" label="Edit values before relaunching" class="mt-2" :isSwitch="true" :inline="true" />
        </template>
        <template #footer>
            <BsButton v-if="!relaunchWithEdit" icon="redo" @click="relaunchJob(tempJobId,relaunchVerbose);showRelaunch=false">Relaunch</BsButton>
            <BsButton v-else icon="edit" @click="editAndRelaunchJob(tempJobId);showRelaunch=false">Edit & Relaunch</BsButton>
        </template>
    </BsModal>
    <!-- Modal - approval -->
    <BsModal v-if="showApprove" @close="showApprove=false">
        <template #title> Approve job {{ tempJobId }} </template>
        <template #default>
            <p class="mt-3 fs-6 user-select-none">Are you sure you want to approve job <strong>{{ tempJobId }}</strong>?</p>
            <BsDivider type="text" text="Approval info" />
            <p v-html="approvalMessage"></p>            
        </template>
        <template #footer><BsButton icon="circle-check" @click="approveJob(tempJobId);showApprove=false">Approve</BsButton></template>
    </BsModal>
    <!-- Modal - reject -->
    <BsModal v-if="showReject" @close="showReject=false">
        <template #title> Reject job {{ tempJobId }} </template>
        <template #default><p class="mt-3 fs-6 user-select-none">Are you sure you want to reject job <strong>{{ tempJobId }}</strong>?</p></template>
        <template #footer><BsButton icon="circle-xmark" @click="rejectJob(tempJobId);showReject=false">Reject</BsButton></template>
    </BsModal>
    <main class="d-flex container-xxl">
        
        <AppSettings title="Jobs" icon="history">
            <template #feedback>
                <div class="input-group ms-5" style="width: 400px;">
                    <span class="input-group-text">
                        <FaIcon icon="search" />
                    </span>
                    <input v-model="filter" type="text" class="form-control text-start" placeholder="regex (on anything)" />
                </div>
            </template>
            <template #actions>
                <div class="d-flex justify-content-end align-items-center">
                    <BsButton icon="refresh" @click="loadJobs" cssClass="me-2">Refresh</BsButton>
                    <div class="input-group me-2" style="width:300px">
                        <span class="input-group-text">
                            <FaIcon icon="list-ol" />
                        </span>
                        <select v-model="lines" class="form-select">
                            <option value="100">100</option>
                            <option value="200">200</option>
                            <option value="500">500</option>
                            <option value="1000">1000</option>
                        </select>
                    </div>
                </div>
            </template>            
            <table class="custom-table table-bordered table-sm">
                <thead>
                    <tr class="text-start">
                        <th class="action"></th>
                        <th class="id">id</th>
                        <th>form</th>
                        <th class="jobtype">job type</th>
                        <th class="status">status</th>
                        <th>start time</th>
                        <th>end time</th>
                        <th>user</th>
                    </tr>
                </thead>
                <tbody>
                <template v-for="j in displayedJobs" :key="j.id">
                    <tr :class="jobBackground(j)">
                        <td>
                            <span role="button" v-if="j.status!='running' && canRelaunchJobs" class="me-2 text-info" @click="tempJobId=j.id;showRelaunch=true" title="Relaunch job"><font-awesome-icon icon="redo" /></span>
                            <span role="button" v-if="j.status=='running' && !j.abort_requested" class="me-2 text-warning" @click="tempJobId=j.id;showAbort=true" title="Abort job"><font-awesome-icon icon="ban" /></span>
                            <span role="button" v-if="j.status!='running' && !j.abort_requested || store.isAdmin" class="me-2 text-danger" @click="tempJobId=j.id;showDelete=true" title="Delete job"><font-awesome-icon icon="trash-alt" /></span>
                            <span role="button" v-if="j.status=='approve' && approvalAllowed(j)" class="me-2 text-success" @click="tempJobId=j.id;showApproval(j.id)" title="Approve job"><font-awesome-icon icon="circle-check" /></span>
                            <span role="button" v-if="j.status=='approve' && approvalAllowed(j)" class="me-2 text-danger" @click="tempJobId=j.id;showApproval(j.id,true)" title="Reject job"><font-awesome-icon icon="circle-xmark" /></span>
                        </td>
                        <td class="is-clickable text-left" @click="(j.job_type=='multistep')?toggleCollapse(j.id):loadOutput(j.id)">
                            <span>{{j.id}}</span>
                            <template v-if="j.job_type=='multistep'">
                            <span class="mx-2 float-end" v-if="!collapsed[j.id]"><font-awesome-icon icon="angle-right" /></span>
                            <span class="mx-2 float-end" v-else><font-awesome-icon icon="angle-down" /></span>
                            </template>
                        </td>
                        <td role="button" class="text-start" @click="getJob(j.id)" :title="j.form">{{j.form}}</td>
                        <td role="button" class="text-start" @click="getJob(j.id)" :title="j.job_type">{{j.job_type || "ansible" }}</td>
                        <td role="button" class="text-start" @click="getJob(j.id)" :title="j.status">{{j.status}}</td>
                        <td role="button" class="text-start" @click="getJob(j.id)" :title="j.start">{{ formatTime(j.start) }}</td>
                        <td role="button" class="text-start" @click="getJob(j.id)" :title="j.end">{{ formatTime(j.end) }}</td>
                        <td role="button" class="text-start" @click="getJob(j.id)" :title="j.user">{{j.user}} ({{j.user_type}})</td>
                    </tr>
                    <template v-for="c in childJobs(j.id)" :key="c.id">
                    <tr :class="jobBackground(c)">
                        <td class="table-info">
                        <!-- <span v-if="isAdmin" class="icon text-danger is-clickable" @click="tempJobId=c.id;showDelete=true" title="Delete job"><font-awesome-icon icon="trash-alt" /></span> -->
                        </td>
                        <td role="button" class="text-end" @click="getJob(c.id)">{{c.id}}</td>
                        <td role="button" class="text-start" @click="getJob(c.id)" :title="c.target">{{c.target}}</td>
                        <td role="button" class="text-start" @click="getJob(c.id)" :title="c.job_type">{{c.job_type || "ansible" }}</td>
                        <td role="button" class="text-start" @click="getJob(c.id)" :title="c.status">{{c.status}}</td>
                        <td role="button" class="text-start" @click="getJob(c.id)" :title="c.start">{{ formatTime(c.start) }}</td>
                        <td role="button" class="text-start" @click="getJob(c.id)" :title="c.end">{{ formatTime(c.start) }}</td>
                        <td role="button" class="text-start" @click="getJob(c.id)" :title="c.user">{{c.user}} ({{c.user_type}})</td>
                    </tr>
                    </template>
                </template>
                </tbody>
            </table>
            <BsPagination
                v-if="!isLoading"
                :dataList="parentJobs"
                :buttonsShown="7"
                :index="displayedJobIndex"
                name="jobs"
                @change="setDisplayJobs"            
            />
            <div v-if="job"  class="row">
                <div class="col">
                    <h3>Job output for job {{jobId}}
                        <sup><span class="badge rounded-pill me-2 text-bg-info">{{ job.job_type || 'ansible'}}</span></sup>
                        <sup><span class="badge rounded-pill" :class="Helpers.getColorClassByStatus(job.status,'text-bg')">{{ job.status}}</span></sup>
                    </h3>
                    <BsButton
                        v-if="store.profile.options?.showExtravars ?? true"
                        cssClass="btn-sm me-2 fw-normal"
                        cssClassToggle="btn-sm me-2 fw-normal"
                        icon="eye"
                        iconToggle="eye-slash"
                        :toggle="showExtraVars"
                        @click="showExtraVars=!showExtraVars;showArtifacts=false"
                        >Show Extravars<template #toggle>Hide Extravars</template>
                    </BsButton>
                    <BsButton
                        v-if="(store.profile.options?.showArtifacts ?? true) && job.job_type=='awx'"
                        cssClass="btn-sm me-2 fw-normal"
                        cssClassToggle="btn-sm me-2 fw-normal"
                        icon="square-poll-vertical"
                        iconToggle="square-poll-horizontal"
                        :toggle="showArtifacts"
                        @click="showArtifacts=!showArtifacts;showExtraVars=false"
                        >Show Artifacts<template #toggle>Hide Artifacts</template>
                    </BsButton>                    
                    <BsButton @click="loadOutput(jobId)" icon="sync-alt" cssClass="btn-sm me-2 fw-normal">Refresh</BsButton>
                    <BsButton 
                        cssClass="btn-sm me-2 fw-normal"
                        cssClassToggle="btn-sm me-2 fw-normal"
                        icon="filter"
                        iconToggle="filter-circle-xmark"
                        :toggle="hide"
                        @click="hide=!hide"
                        >Apply filter<template #toggle>Remove filter</template></BsButton>
                    <BsButton @click="download(jobId)" icon="download" cssClass="btn-sm me-2 fw-normal">Download Job</BsButton>

                    <div class="row mt-4">
                        <div class="col">
                            <AppAnsibleOutput :output="filteredJobOutput">
                            <template #title>
                                <h3 v-if="subjob">Main job (jobid {{jobId}}) 
                                <sup><span class="badge rounded-pill status" :class="Helpers.getColorClassByStatus(job.status,'bg')">{{ job.status }}</span></sup> 
                                </h3>
                            </template>
                            </AppAnsibleOutput>
                        </div>
                        <div class="col" v-if="subjob">
                            <AppAnsibleOutput :output="filteredSubJobOutput">
                            <template #title>
                                <h3>Current Step (jobid {{subjobId}}) 
                                <sup><span class="badge rounded-pill status" :class="Helpers.getColorClassByStatus(subjob.status,'bg')">{{ subjob.status }}</span></sup>
                                </h3>               
                            </template>
                            </AppAnsibleOutput>
                        </div>
                    </div>
                </div>

                <!-- extra vars column -->
                <div v-if="showExtraVars" class="col is-clipped-horizontal">
                    <h3>Extravars</h3>
                    <div class="d-flex justify-content-between">
                        <div>
                            <BsButton
                            cssClass="btn-sm"
                            cssClassToggle="btn-sm"
                            :toggle="viewAsYaml"
                            @click="viewAsYaml = !viewAsYaml"
                            >
                                <template #default>View as YAML</template>
                                <template #toggle>View as JSON</template>
                            </BsButton>
                        </div>
                        <!-- TOOLBAR ICONS-->
                        <div>
                            <span class="ms-2" role="button" title="Copy ExtraVars" @click="clip(job.extravars,false,viewAsYaml)">
                                <font-awesome-icon icon="copy" class="text-primary" />
                            </span>
                        </div>
                    </div>
                    <div class="mt-4 p-3 card is-clipped-horizontal" v-if="!viewAsYaml" >
                        <VueJsonPretty :data="job.extravars" />
                    </div>
                    <div class="mt-4 p-3 card is-clipped-horizontal" v-else>
                        <pre v-highlightjs><code language="yaml" style="border:none;padding:0">{{ YAML.stringify(job.extravars) }}</code></pre>
                    </div>
                </div>
                <!-- extra vars column -->
                <div v-if="showArtifacts && job.job_type=='awx'" class="col is-clipped-horizontal">
                    <h3>Artifacts</h3>
                    <div class="d-flex justify-content-between">
                        <div>
                            <BsButton
                            cssClass="btn-sm"
                            cssClassToggle="btn-sm"
                            :toggle="viewAsYaml"
                            @click="viewAsYaml = !viewAsYaml"
                            >
                                <template #default>View as YAML</template>
                                <template #toggle>View as JSON</template>
                            </BsButton>
                        </div>
                        <!-- TOOLBAR ICONS-->
                        <div>
                            <span class="ms-2" role="button" title="Copy Artifacts" @click="clip(job.awx_artifacts,false,viewAsYaml)">
                                <font-awesome-icon icon="copy" class="text-primary" />
                            </span>
                        </div>
                    </div>
                    <div class="mt-4 p-3 card is-clipped-horizontal" v-if="!viewAsYaml" >
                        <VueJsonPretty :data="job.awx_artifacts" />
                    </div>
                    <div class="mt-4 p-3 card is-clipped-horizontal" v-else>
                        <pre v-highlightjs><code language="yaml" style="border:none;padding:0">{{ YAML.stringify(job.awx_artifacts) }}</code></pre>
                    </div>
                </div>                
            </div>

        </AppSettings>
    </main>
  </div>
</template>
<style scoped>
    .is-clipped-horizontal {
        overflow-x: hidden;
    }
    .custom-table {
        width: 100%;
        margin-bottom: 1rem;
    }
    tr.table-selected {
        border: 2px solid;
        border-left: none;
        border-right: none;
        td{
            border-left: none;
            border-right: none;
        }
    }
    
</style>