'use strict';
const logger=require("../lib/logger");
const mysql=require("./db.model");
const {encrypt,decrypt}=require("../lib/crypto")
const NodeCache = require("node-cache")

const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});


//credential object create
var Credential=function(credential){
    this.name = credential.name;
    this.host = credential.host;
    this.port = credential.port;
    this.user = credential.user;
    this.secure = (credential.secure)?1:0;
    this.password = encrypt(credential.password);
    this.description = credential.description;
};

Credential.create = function (record) {
    logger.info(`Creating credential ${record.name}`)
    return mysql.do("INSERT INTO AnsibleForms.`credentials` set ?", record)
    .then((res)=>{ return res.insertId })
};
Credential.update = function (record,id) {
    logger.info(`Updating credential ${record.name}`)
    return mysql.do("UPDATE AnsibleForms.`credentials` set ? WHERE id=?", [record,id])
    .then((res)=>{
      cache.del(record.name)
      return res
    })
};
Credential.delete = function(id){
    logger.info(`Deleting credential ${id}`)
    return mysql.do("DELETE FROM AnsibleForms.`credentials` WHERE id = ? AND name<>'admins'", [id])
};
Credential.findAll = function () {
    logger.info("Finding all credentials")
    return mysql.do("SELECT id,name,user,host,port,description FROM AnsibleForms.`credentials`;")
};
Credential.findById = function (id) {
    logger.info(`Finding credential ${id}`)
    return mysql.do("SELECT * FROM AnsibleForms.`credentials` WHERE id=?;",id)
    .then((res)=>{
      if(res.length>0){
        try{
          res[0].password = decrypt(res[0].password)
        }catch(e){
          logger.error("Failed to decrypt the password.  Did the secretkey change ?")
          res[0].password = ""
        }
        return res
      }else{
        throw `No credential found with id ${id}`
      }
    })
};
Credential.findByName2 = function (name) {
    logger.info(`Finding credential ${name}`)
    return mysql.do("SELECT * FROM AnsibleForms.`credentials` WHERE name=?;",name)
    .then((res)=>{
      if(res.length>0){
        try{
          res[0].password = decrypt(res[0].password)
        }catch(e){
          logger.error("Failed to decrypt the password.  Did the secretkey change ?")
          res[0].password = ""
        }
        return res
      }else{
        throw `No credential found named ${name}`
      }
    })
};
Credential.findByName = function (name) {
  logger.debug(`Finding credential ${name}`)
  var cred = cache.get(name)
  if(cred==undefined){
    return mysql.do("SELECT host,port,name,user,password,secure FROM AnsibleForms.`credentials` WHERE name=?;",name)
    .then((res)=>{
      if(res.length>0){
        res[0].multipleStatements = true
        try{
          res[0].password = decrypt(res[0].password)
        }catch(e){
          logger.error("Failed to decrypt the password.  Did the secretkey change ?")
          res[0].password = ""
        }
        cache.set(name,res[0])
        logger.debug("Caching credentials " + name + " from database")
        return JSON.parse(JSON.stringify(res[0]))
      }else{
        throw new Error("No credential found named " + name)
      }
    })
  }else{
    // logger.debug("returning credentials " + name + " from cache")
    return Promise.resolve(cred)
  }
};

module.exports= Credential;
