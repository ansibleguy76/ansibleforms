'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import crypto from "../lib/crypto.js";

//azuread object create
var AzureAd=function(azuread){
    this.client_id = azuread.client_id;
    this.secret_id = crypto.encrypt(azuread.secret_id);
    this.enable = (azuread.enable)?1:0;
    this.groupfilter = azuread.groupfilter;
};
AzureAd.update = function (record) {
  logger.info(`Updating azuread`)
  return mysql.do("UPDATE AnsibleForms.`azuread` set ?", record)
};
AzureAd.isEnabled = function(){
  return mysql.do("SELECT enable,groupfilter FROM AnsibleForms.`azuread` limit 1;")
    .then((res)=>{
      if(res.length>0){
        return res[0]
      }else{
        logger.error("No azuread record in the database, something is wrong")
        throw "No azuread record in the database, something is wrong"
      }
    })
}

AzureAd.find = function(){
  return mysql.do("SELECT * FROM AnsibleForms.`azuread` limit 1;")
    .then((res)=>{
      if(res.length>0){
        try{
          if(res[0].secret_id!=""){
            res[0].secret_id=crypto.decrypt(res[0].secret_id)
          }
        }catch(e){
          logger.error("Couldn't decrypt azuread secret id, did the secretkey change ?")
          res[0].secret_id=""
        }
        return res[0]
      }else{
        logger.error("No azuread record in the database, something is wrong")
        throw "No azuread record in the database, something is wrong"
      }
    })
}

AzureAd.check = function(azureadConfig){
  return new Promise(async (resolve,reject)=>{
    // TODO
  })
}

export default AzureAd;
