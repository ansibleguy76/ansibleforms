'use strict';
const logger=require("../lib/logger");
const fsPromises=require("fs").promises
const YAML=require("yaml")
var config=require('../../config/app.config')
const moment = require("moment")

//lock object create
var Lock=function(){

};
Lock.status = function(user){
  return Lock.get()
    .then((lock)=>{
      const lck=YAML.parse(lock)
      const match=((user.username===lck.username)&&(user.type===lck.type))
      const result={
        lock:lck,
        match:match,
        free:false,
      }
      return Promise.resolve(result)
    })
    .catch((e)=>{
      if(e.code==="ENOENT"){
        return Promise.resolve({free:true})
      }else{
        return Promise.reject(e.toString())
      }
    })
}
Lock.set = function (user) {
  if(config.showDesigner){
    logger.notice(`Creating lock for user ${user.username}`)
    user.created = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
    return fsPromises.writeFile(config.lockPath,YAML.stringify(user),{encoding:"utf8",flag:"w"})
  }else{
    logger.error("Designer is disabled, can't set lock")
    return Promise.reject('Designer is disabled')
  }
};
Lock.delete = function(){
    if(config.showDesigner){
      logger.notice(`Deleting lock`)
      return fsPromises.unlink(config.lockPath)
    }else{
      logger.error("Designer is disabled, can't delete lock")
      return Promise.reject('Designer is disabled')
    }

};
Lock.get = function () {
    // logger.notice("Getting lock")
    if(config.showDesigner){
      return fsPromises.readFile(config.lockPath,{encoding:"utf8"})
    }else{
      logger.error("Designer is disabled, can't get lock")
      return Promise.reject('Designer is disabled')
    }
};

module.exports= Lock;
