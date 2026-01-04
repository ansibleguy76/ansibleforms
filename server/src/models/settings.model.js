'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import nodemailer from "nodemailer";
import crypto from "../lib/crypto.js";
import Repository from './repository.model.js';
import appConfig from "./../../config/app.config.js";
import fs from 'fs';

//mail object create
var Settings=function(settings){
    this.mail_server = settings.mail_server;
    this.mail_port = settings.mail_port;
    this.mail_secure = (settings.mail_secure)?1:0;
    this.mail_username = settings.mail_username;
    if(settings.mail_password){
      this.mail_password = crypto.encrypt(settings.mail_password);
    }
    this.mail_from = settings.mail_from;
    this.url = settings.url;
    this.forms_yaml = settings.forms_yaml || "";
};
Settings.update = function (record) {
    logger.info(`Updating settings`)
    return mysql.do("UPDATE AnsibleForms.`settings` set ?", record)
};
Settings.importFormsFileFromYaml = async function(){
  // Repository.getConfigPath() already handles config.yaml → forms.yaml fallback
  var configPath = (await Repository.getConfigPath()) || appConfig.configPath
  
  if(!fs.existsSync(configPath)){
    // Final fallback to forms.yaml if nothing else exists
    configPath = appConfig.formsPath
    
    if(!fs.existsSync(configPath)){
      logger.error(`Config path ${configPath} doesn't exist`)
      throw new Error(`Config path ${configPath} doesn't exist`)
    }
  }
  
  const isLegacy = configPath.endsWith('forms.yaml')
  
  if(isLegacy){
    logger.warning(`Using forms.yaml is DEPRECATED. Please migrate to config.yaml.`)
  }
  
  logger.notice(`Loading ${configPath} into the database`)  
  let configFile = fs.readFileSync(configPath, 'utf8')
  var settings = await Settings.findFormsYaml()
  settings.forms_yaml = configFile
  await Settings.update(settings)
  
  if(isLegacy){
    return "forms.yaml imported successfully (DEPRECATED - please migrate to config.yaml)"
  }
  return "config.yaml imported successfully"

}
Settings.find = function () {

  return mysql.do("SELECT * FROM AnsibleForms.`settings` limit 1;")
    .then((res)=>{
      if(res.length>0){
        try{
          if(res[0].mail_password!=""){
            res[0].mail_password=crypto.decrypt(res[0].mail_password)
          }
        }catch(e){
          logger.error("Couldn't decrypt mail password, did the secretkey change ?")
          res[0].mail_password=""
        }
        res[0].enableFormsYamlInDatabase = appConfig.enableFormsYamlInDatabase
        return res[0]
      }else{
        logger.error("No settings record in the database, something is wrong")
        throw "No settings record in the database, something is wrong"
      }
    })

};
Settings.findMailSettings = function () {
  return mysql.do("SELECT mail_server,mail_port,mail_secure,mail_username,mail_password,mail_from FROM AnsibleForms.`settings` limit 1;")
    .then((res)=>{
      if(res.length>0){
        try{
          if(res[0].mail_password!=""){
            res[0].mail_password=decrypt(res[0].mail_password)
          }
        }catch(e){
          logger.error("Couldn't decrypt mail password, did the secretkey change ?")
          res[0].mail_password=""
        }
        return res[0]
      }else{
        logger.error("No settings record in the database, something is wrong")
        throw "No settings record in the database, something is wrong"
      }
    })

};
Settings.findUrl = function () {

  return mysql.do("SELECT url FROM AnsibleForms.`settings` limit 1;")
    .then((res)=>{
      if(res.length>0){
        return res[0]
      }else{
        logger.error("No settings record in the database, something is wrong")
        throw "No settings record in the database, something is wrong"
      }
    })

};
Settings.findFormsYaml = function () {

  return mysql.do("SELECT forms_yaml FROM AnsibleForms.`settings` limit 1;")
    .then((res)=>{
      if(res.length>0){
        return res[0]
      }else{
        logger.error("No settings record in the database, something is wrong")
        throw "No settings record in the database, something is wrong"
      }
    })

};
Settings.mailcheck = function(config,to){
  var subject= "Test message"
  var message= "<p>This is a test message from AnsibleForms</p>"
  if(config.mail_password){
    try{
      config.mail_password=decrypt(config.mail_password)
    }catch(e){
      config.mail_password=""
      logger.error("Failed to decrypt mail password")
    }
  }
  logger.info("Sending testmail")
  return Settings.maildo(config,to,subject,message)
}
Settings.mailsend = function(to,subject,message){
  return Settings.findMailSettings()
    .then((config)=>{
      return Settings.maildo(config,to,subject,message)
    })
}
Settings.maildo = function(config,to,subject,message){
  var mailConfig
  if(!config.mail_server)return false
  if(config.mail_username){
    mailConfig = {
      host: config.mail_server,
      port: config.mail_port,
      secure: !!config.mail_secure,
      auth: {
        user: config.mail_username,
        pass: config.mail_password
      },
      tls: {
          rejectUnauthorized: false
      }
    }
  }else{
    mailConfig = {
      host: config.mail_server,
      port: config.mail_port,
      secure: !!config.mail_secure,
      tls:{
          rejectUnauthorized: false
      }
    }
  }
  var mailmessage = {
    from: config.mail_from,
    to: to,
    subject: subject,
    html: message
  };
  // console.log(mailConfig)
  // console.log(message)
  let transporter = nodemailer.createTransport(mailConfig);
  return transporter.sendMail(mailmessage)
    .then((info)=>{
      if(info.messageId){
        return info.messageId
      }else{
        return "No messageId"
      }
  })
}
export default  Settings;
