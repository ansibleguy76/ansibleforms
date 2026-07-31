'use strict';

import logger from "../lib/logger.js";
import Job from "./job.model.js";
import yaml from 'yaml';
import CrudModel from './crud.model.js';
import mysql from './db.model.js';
import cronService from '../services/cron.service.js';

class Schedule extends CrudModel {
  static modelName = 'schedule';

  static async create(data) {
    logger.info(`Creating schedule ${data.name}`);
    return super.create(this.modelName, data);
  }
  static async update(data, id) {
    // drop unwanted fields from update, used internal only
    // last_run, output, state, status, queue_id
    delete data.last_run
    delete data.output
    delete data.state
    delete data.queue_id
    logger.info(`Updating schedule ${(data.name) ? data.name : id}`);
    return super.update(this.modelName, data, id);
  }
  static async delete(id) {
    logger.info(`Deleting schedule ${id}`);
    return super.delete(this.modelName, id);
  }
  static async findAll() {
    logger.info("Finding all schedules");
    return super.findAll(this.modelName);
  }
  static async findById(id) {
    logger.info(`Finding schedule ${id}`);
    return super.findById(this.modelName, id);
  }

  static async findByName(name) {
    logger.info(`Finding schedule ${name}`);
    return super.findByName(this.modelName, name);
  }

  static async queue(id) {
    // set to queued
    logger.info(`Queuing schedule ${id}`);
    // One statement, so the next queue number is read and written atomically - the same
    // shape as Ds.queue. Reading every row, computing max+1 and writing it back let a
    // cron tick and a manual queue interleave and hand two schedules the same queue_id,
    // which is the ordering the processor depends on (ORDER BY queue_id LIMIT 1).
    //
    // The derived table is required: MySQL refuses a subquery reading the same table an
    // UPDATE targets unless it is wrapped one level deeper.
    await mysql.do(
      "UPDATE AnsibleForms.`schedule` SET state='queued', queue_id=(SELECT n FROM (SELECT COALESCE(MAX(queue_id),0)+1 AS n FROM AnsibleForms.`schedule`) t) WHERE id=?",
      [id]);
    logger.info(`Queued schedule ${id}`);
  }

  static async launch(id) {
    let status = "success";
    let output;
    const schedule = await super.findById(this.modelName, id);
    const currentDate = new Date()

    // Claim the schedule before doing any work.
    //
    // Nothing ever wrote state='running', so both guards that test for it were dead: the
    // queue processor's "is one still running" check in init/index.js (which exists for
    // two instances sharing a database) and the cron trigger's own check. The row stayed
    // 'queued' for the whole run, so the processor's next pass - 10 seconds later - saw
    // the same queued schedule and launched it again.
    await super.update(this.modelName, { state: 'running' }, id);

    try {
      // All of this is inside the try now. It used to run before it, so a schedule whose
      // extra_vars were not a dictionary THREW out of launch() with the row still
      // 'queued' - and the processor picked it straight back up, every 10 seconds,
      // forever, logging the same failure each time. A bad schedule must fail once and
      // be recorded as failed, not spin.
      const form = schedule.form;
      let user = {};
      let extravars = yaml.parse(schedule.extra_vars || '{}');
      // null and arrays are also typeof 'object' ; those reached the spread below and
      // died with an unhelpful TypeError
      if (typeof extravars !== 'object' || extravars === null || Array.isArray(extravars)) {
        throw new Error("Extra vars is not a valid dictionary.");
      }
      user.id = 0;
      user.username = 'Schedule Service';
      user.type = 'schedule';
      user.groups = [];
      user.roles = ['admin'];
      extravars.schedule = { ...schedule };
      delete extravars.schedule.output;
      delete extravars.schedule.status;
      delete extravars.schedule.state;
      delete extravars.schedule.last_run;
      delete extravars.schedule.cron;
      delete extravars.schedule.extra_vars;
      extravars.ansibleforms_user = user;
      // Job.launch is fire-and-forget and returns { id } - always truthy - so the else
      // below was unreachable and a schedule whose playbook failed still read 'success'.
      // Report what is actually known: the job was STARTED, and name it so the operator
      // can follow it. The job's own status is the verdict on the run.
      const launched = await Job.launch({ form, user, extravars });
      if (launched?.id) {
        output = `The schedule started job ${launched.id}.\nThis says the job was launched, not that it succeeded - open that job to see how it ended.`;
      } else {
        output = `The schedule ran but no job was created.\nCheck the job log that launched the schedule for more details.`;
        status = "failed";
      }
    } catch (err) {
      logger.error("Errors in schedule launch: ", err);
      output = "Failed to launch : " + err.message;
      status = "failed";
    }
    await super.update(this.modelName, { output, status, state: 'idle', last_run: currentDate }, id);
    
    // Auto-delete one-time schedules after execution
    if(schedule.one_time_run === 1){
      logger.info(`Deleting one-time schedule '${schedule.name}' after execution`);
      await super.delete(this.modelName, id);
      // Remove from cron service to stop checking
      cronService.removeSchedule(id);
    }
  }
}

export default  Schedule;
