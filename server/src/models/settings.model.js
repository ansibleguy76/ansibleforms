'use strict';
const logger=require("../lib/logger");
const mysql=require("./db.model")
const Helpers=require("../lib/common")
const nodemailer=require("nodemailer")
const {encrypt,decrypt} = require("../lib/crypto")

//mail object create
var Settings=function(settings){
    this.mail_server = settings.mail_server;
    this.mail_port = settings.mail_port;
    this.mail_secure = (settings.mail_secure)?1:0;
    this.mail_username = settings.mail_username;
    if(settings.mail_password){
      this.mail_password = encrypt(settings.mail_password);
    }
    this.mail_from = settings.mail_from;
    this.url = settings.url;
};
Settings.update = function (record) {
    logger.info(`Updating settings`)
    return mysql.do("UPDATE AnsibleForms.`settings` set ?", record)
};
Settings.find = function () {

  return mysql.do("SELECT * FROM AnsibleForms.`settings` limit 1;")
    .then((res)=>{
      if(res.length>0){
        try{
          res[0].mail_password=decrypt(res[0].mail_password)
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
  return Settings.maildo(config,to,subject,message)
}
Settings.mailsend = function(to,subject,message){
  return Settings.find()
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
      }
    }
  }else{
    mailConfig = {
      host: config.mail_server,
      port: config.mail_port,
      secure: !!config.mail_secure
    }
  }
  var message = {
    from: config.mail_from,
    to: to,
    subject: subject,
    html: message
  };
  // console.log(mailConfig)
  // console.log(message)
  let transporter = nodemailer.createTransport(mailConfig);
  return transporter.sendMail(message)
    .then((info)=>{
      if(info.messageId){
        return info.messageId
      }else{
        return "No messageId"
      }
  })
}
module.exports= Settings;
