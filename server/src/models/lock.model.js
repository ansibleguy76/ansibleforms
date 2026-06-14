'use strict';
import logger from "../lib/logger.js";
import { promises as fsPromises } from "fs";
import yaml from "yaml";
import config from '../../config/app.config.js';
import moment from "moment";
import Repository from "./repository.model.js";
import Settings from "./settings.model.js";
import Errors from '../lib/errors.js';

//lock object create
var Lock=function(){

};
// lightweight check : is the designer lock currently held by anyone ? used by
// background jobs (cron pull) to avoid running git on a working tree while the
// designer is editing it, even before the first save makes the tree dirty
// (issue #414)
Lock.isHeld = async function(){
  try {
    await fsPromises.access(config.lockPath);
    return true;
  } catch (e) {
    return false; // ENOENT (or unreadable) => treat as not held
  }
};
Lock.status = async function(user){
  // forms repositories are read AND write (issue #414) : the designer edits
  // their working trees, so they no longer disable the designer
  const settings = await Settings.findFormsYaml();
  if (settings.forms_yaml) {
    throw new Errors.AccessDeniedError("Designer is disabled: forms stored in database");
  }
  try {
    const lock = await Lock.get(user);
    const lck = yaml.parse(lock);
    const match = ((user.username === lck.username) && (user.type === lck.type));
    return { lock: lck, match, free: false };
  } catch (e) {
    if (e.code === "ENOENT") {
      return { free: true };
    }
    throw e;
  }
};
Lock.set = async function (user) {
  if (config.showDesigner && user.options.showDesigner) {
    // refresh the forms repositories first so the designer edits the latest
    // remote state (best effort ; a dirty tree or network error must not block
    // the designer, unpushed work is preserved by the rebase on sync)
    try {
      await Repository.pullFormsRepositories();
    } catch (e) {
      logger.warning(`Failed to refresh the forms repositories : ${e.message}`);
    }
    logger.notice(`Creating lock for user ${user.username}`);
    const copy = { ...user, created: moment(Date.now()).format('YYYY-MM-DD HH:mm:ss') };
    await fsPromises.writeFile(config.lockPath, yaml.stringify(copy), { encoding: "utf8", flag: "w" });
    return { message: 'Lock set', user: { username: copy.username, type: copy.type } };
  }
  logger.error("Designer is disabled, can't set lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};
Lock.delete = async function(user={}){
  if (config.showDesigner && user.options.showDesigner) {
    logger.notice(`Deleting lock`);
    try {
      await fsPromises.unlink(config.lockPath);
      return { message: 'Lock deleted' };
    } catch (e) {
      if (e.code === 'ENOENT') {
        // deleting a non-existent lock is idempotent
        return { message: 'Lock not present', deleted: false };
      }
      throw e;
    }
  }
  logger.error("Designer is disabled, can't delete lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};
Lock.get = async function (user={}) {
  if (config.showDesigner && user.options.showDesigner) {
    return fsPromises.readFile(config.lockPath, { encoding:"utf8" });
  }
  logger.error("Designer is disabled, can't get lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};

export default  Lock;
