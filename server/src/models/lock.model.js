'use strict';
import logger from "../lib/logger.js";
import { promises as fsPromises } from "fs";
import yaml from "yaml";
import config from '../../config/app.config.js';
import moment from "moment";
import Repository from "./repository.model.js";
import Settings from "./settings.model.js";

//lock object create
var Lock=function(){

};
Lock.status = async function(user){
  const hasFormsRepository = await Repository.hasFormsRepository()
  const settings = await Settings.findFormsYaml()
  if(hasFormsRepository){
    throw new Error("Designer is disabled, Forms repository found.")
  }
  if(settings.forms_yaml){
    throw new Error("Designer is disabled, Forms are stored in the database.")
  }  
  try{
    const lock = await Lock.get()
    const lck=yaml.parse(lock)
    const match=((user.username===lck.username)&&(user.type===lck.type))
    const result={
      lock:lck,
      match:match,
      free:false,
    }
    return result
  }catch(e){
    if(e.code==="ENOENT"){
      return {free:true}
    }else{
      throw e
    }
  }
}
Lock.set = function (user) {
  if(config.showDesigner && (user.options?.showDesigner ?? true)){
    logger.notice(`Creating lock for user ${user.username}`)
    user.created = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
    return fsPromises.writeFile(config.lockPath,yaml.stringify(user),{encoding:"utf8",flag:"w"})
  }else{
    logger.error("Designer is disabled, can't set lock")
    return Promise.reject('Designer is disabled')
  }
};
Lock.delete = function(user={}){
  if(config.showDesigner && (user.options?.showDesigner ?? true)){
      logger.notice(`Deleting lock`)
      return fsPromises.unlink(config.lockPath)
    }else{
      logger.error("Designer is disabled, can't delete lock")
      return Promise.reject('Designer is disabled')
    }

};
Lock.get = function (user={}) {
    // logger.notice("Getting lock")
    if(config.showDesigner && (user.options?.showDesigner ?? true)){
      return fsPromises.readFile(config.lockPath,{encoding:"utf8"})
    }else{
      logger.error("Designer is disabled, can't get lock")
      return Promise.reject('Designer is disabled')
    }
};

export default  Lock;
