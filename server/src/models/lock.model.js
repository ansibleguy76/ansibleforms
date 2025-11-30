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
Lock.status = async function(user){
  const hasFormsRepository = await Repository.hasFormsRepository();
  const settings = await Settings.findFormsYaml();
  if (hasFormsRepository) {
    throw new Errors.AccessDeniedError("Designer is disabled: forms repository present");
  }
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
  if (config.showDesigner && (user.options?.showDesigner ?? true)) {
    logger.notice(`Creating lock for user ${user.username}`);
    const copy = { ...user, created: moment(Date.now()).format('YYYY-MM-DD HH:mm:ss') };
    await fsPromises.writeFile(config.lockPath, yaml.stringify(copy), { encoding: "utf8", flag: "w" });
    return { message: 'Lock set', user: { username: copy.username, type: copy.type } };
  }
  logger.error("Designer is disabled, can't set lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};
Lock.delete = async function(user={}){
  if (config.showDesigner && (user.options?.showDesigner ?? true)) {
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
  if (config.showDesigner && (user.options?.showDesigner ?? true)) {
    return fsPromises.readFile(config.lockPath, { encoding:"utf8" });
  }
  logger.error("Designer is disabled, can't get lock");
  throw new Errors.AccessDeniedError('Designer is disabled');
};

export default  Lock;
