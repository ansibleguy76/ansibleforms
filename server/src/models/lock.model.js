'use strict';
const logger=require("../lib/logger");
const fsPromises=require("fs").promises
const YAML=require("yaml")
var config=require('../../config/app.config')
const moment = require("moment")
const Repository = require("./repository.model");
const Repo = require("./repo.model");
const Settings = require("./settings.model");

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
    const lck=YAML.parse(lock)
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
    return fsPromises.writeFile(config.lockPath,YAML.stringify(user),{encoding:"utf8",flag:"w"})
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

module.exports= Lock;
