// The awx runner : a job or workflow template on AWX / Ansible Automation Platform / Ascender.
// The template's output is tracked back into the job by the app (api.js).
import logger from "../../lib/logger.js";
import mysql from "../../models/db.model.js";
import Credential from "../../models/credential.model.v2.js";
// a cycle (job.model imports the orchestrator) ; only used when a job runs
import Job from "../../models/job.model.js";
import Awx, { check } from "./api.js";
import { forgetJobSecrets } from "../../lib/outputMask.js";
import { safeParse } from "../../lib/safejson.js";

export default {
  type: "awx",
  capabilities: { playbook: false, template: true },
  check,
  // resolves once the template has ended and its output is tracked
  async launch(ctx) {
    const { jobId, extravars, credentialMap, runner } = ctx;
    const credentials = await Credential.resolveCredentialMap(extravars.__credentials__ || credentialMap || {});
    // the template's output is tracked here : the credentials' secrets and the password
    // fields' values are masked in it (they are passed to AWX as extra vars)
    const rows = await mysql.do("SELECT form FROM AnsibleForms.`jobs` WHERE id=?", [jobId]);
    await Job.registerOutputSecrets(jobId, { form: rows?.[0]?.form, extravars, credentials });
    try {
      return await Awx.launch(runner, extravars, credentials, jobId, await Job.lastOrder(jobId));
    } finally {
      forgetJobSecrets(jobId);
    }
  },
  // follows again a job its node stopped following (lib/jobResume.js) : resolves once it has
  // ended, null when AWX no longer knows it. Its output is masked as at its launch.
  async resume(ctx) {
    const { jobId, runner } = ctx;
    const rows = await mysql.do("SELECT form, extravars, credentials, awx_id, awx_workflow FROM AnsibleForms.`jobs` WHERE id=?", [jobId]);
    const row = rows?.[0];
    if (!row?.awx_id) return null;
    const extravars = safeParse(row.extravars, {}, `job.extravars id=${jobId}`) || {};
    const credentialMap = safeParse(row.credentials, {}, `job.credentials id=${jobId}`) || {};
    const credentials = await Credential.resolveCredentialMap(extravars.__credentials__ || credentialMap).catch(() => ({}));
    await Job.registerOutputSecrets(jobId, { form: row.form, extravars, credentials });
    try {
      return await Awx.resume(runner, { id: jobId, awx_id: row.awx_id, awx_workflow: row.awx_workflow });
    } finally {
      forgetJobSecrets(jobId);
    }
  },
  // the fast path : cancels the AWX job straight away ; the tracker also sees the abort flag
  async cancel(ctx) {
    const rows = await mysql.do("SELECT awx_id, awx_workflow FROM AnsibleForms.`jobs` WHERE id=?", [ctx.jobId]);
    const awxId = rows?.[0]?.awx_id;
    if (!awxId) return;
    try {
      await Awx.abortJob(ctx.runner, awxId, !!rows[0].awx_workflow);
    } catch (err) {
      logger.debug(`Job ${ctx.jobId} : AWX did not take the cancel (${err.message}) ; the tracker will`);
    }
  },
};
