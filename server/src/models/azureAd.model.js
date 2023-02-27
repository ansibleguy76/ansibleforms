'use strict';
const logger=require("../lib/logger");
const mysql=require("./db.model")
const Helpers=require("../lib/common")
const YAML=require("yaml")
const {encrypt,decrypt} = require("../lib/crypto")

//azuread object create
var AzureAd=function(azuread){
    this.client_id = azuread.client_id;
    this.secret_id = encrypt(azuread.secret_id);
    this.enable = (azuread.enable)?1:0;
};
AzureAd.update = function (record) {
  logger.info(`Updating azuread`)
  return mysql.do("UPDATE AnsibleForms.`azuread` set ?", record)
};
AzureAd.isEnabled = function(){
  return mysql.do("SELECT enable FROM AnsibleForms.`azuread` limit 1;")
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
            res[0].secret_id=decrypt(res[0].secret_id)
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

module.exports= AzureAd;
