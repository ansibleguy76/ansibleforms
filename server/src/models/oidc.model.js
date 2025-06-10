'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import crypto from "../lib/crypto.js";

//oidc object create
var OIDC=function(oidc){
    this.issuer = oidc.issuer;
    this.client_id = oidc.client_id;
    this.secret_id = cryto.encrypt(oidc.secret_id);
    this.enabled = (oidc.enabled)?1:0;
    this.groupfilter = oidc.groupfilter;
};
OIDC.update = function (record) {
  logger.info(`Updating OIDC`)
  return mysql.do("UPDATE AnsibleForms.`oidc` set ?", record)
};
OIDC.isEnabled = function(){
  return mysql.do("SELECT enabled,groupfilter, issuer FROM AnsibleForms.`oidc` limit 1;")
    .then((res)=>{
      if(res.length>0){
        return res[0]
      }else{
        logger.error("No OIDC record in the database, something is wrong")
        throw "No OIDC record in the database, something is wrong"
      }
    })
}

OIDC.find = function(){
  return mysql.do("SELECT * FROM AnsibleForms.`oidc` limit 1;")
    .then((res)=>{
      if(res.length>0){
        try{
          if(res[0].secret_id!=""){
            res[0].secret_id=crypto.decrypt(res[0].secret_id)
          }
        }catch(e){
          logger.error("Couldn't decrypt OIDC secret id, did the secretkey change ?")
          res[0].secret_id=""
        }
        return res[0]
      }else{
        logger.error("No OIDC record in the database, something is wrong")
        throw "No OIDC record in the database, something is wrong"
      }
    })
}

OIDC.check = function(oidcConfig){
  return new Promise(async (resolve,reject)=>{
    // TODO
  })
}

export default  OIDC;
