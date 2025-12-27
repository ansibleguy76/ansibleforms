'use strict';

import logger from "../lib/logger.js";
import Job from "./job.model.js";
import yaml from 'yaml';
import CrudModel from './crud.model.js';

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
    const queue = await super.findAll(this.modelName);
    const maxQueueId = Math.max(0, ...queue.map(s => s.queue_id || 0));
    const queue_id = maxQueueId + 1;
    await super.update(this.modelName, { state: 'queued', queue_id }, id);
    logger.info(`Queued schedule ${id}`);
  }

  static async launch(id) {
    let status = "success";
    let output = "";
    const schedule = await super.findById(this.modelName, id);
    
    // get the form data
    const form = schedule.form;
    let user = {};
    let extravars = yaml.parse(schedule.extra_vars || '{}');
    if (typeof extravars !== 'object') {
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
    const currentDate = new Date()
    try {
      const success = await Job.launch({ form, user, extravars });
      if (success) {
        output = `The schedule has been successfully run.\nThis is not a guarantee that the data is correct, only that the process has completed.\nCheck the job log that launched the schedule for more details.`;
      } else {
        output = `The schedule has been run but there was an error.\nCheck the job log that launched the schedule for more details.`;
        status = "failed";
      }
    } catch (err) {
      logger.error("Errors in schedule launch: ", err);
      output = "Failed to launch : " + err.message;
      status = "failed";
    }
    await super.update(this.modelName, { output, status, state: 'idle', last_run: currentDate }, id);
  }
}

export default  Schedule;
