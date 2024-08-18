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
  if(credential.name!=undefined){this.name = credential.name }
  if(credential.host!=undefined){this.host = credential.host }
  if(credential.port!=undefined){this.port = credential.port }
  if(credential.user!=undefined){this.user = credential.user }
  if(credential.db_name!=undefined){this.db_name = credential.db_name }
  if(credential.secure!=undefined){this.secure = (credential.secure)?1:0 }
  if(credential.is_database!=undefined){this.is_database = (credential.is_database)?1:0 }
  if(credential.password!=undefined){this.password = encrypt(credential.password) }
  if(credential.description!=undefined){this.description = credential.description }
  if(credential.db_type!=undefined){this.db_type = credential.db_type }
};

Credential.create = async function (record) {
    if(!record.name){
      throw "Name is required"
    }  
    logger.info(`Creating credential ${record.name}`)
    var res = await mysql.do("INSERT INTO AnsibleForms.`credentials` set ?", record)
    return res.insertId
};
Credential.update = async function (record,id) {
    const r = await Credential.findById(id) // quickly search name
    record.name = r[0].name  
    logger.info(`Updating credential ${record.name}`)
    var res = await mysql.do("UPDATE AnsibleForms.`credentials` set ? WHERE id=?", [record,id])
    cache.del(record.name)
    return res
};
Credential.delete = async function(id){
    logger.info(`Deleting credential ${id}`)
    var res = await mysql.do("DELETE FROM AnsibleForms.`credentials` WHERE id = ? AND name<>'admins'", [id])
    return res
};
Credential.findAll = async function () {
    logger.info("Finding all credentials")
    var res = await mysql.do("SELECT id,name,user,host,port,description,secure,db_type,db_name,is_database FROM AnsibleForms.`credentials`;")
    return res
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
Credential.findByName = async function (name,fallbackName="") {
  logger.debug(`Finding credential ${name}`)
  var cred = cache.get(name)

  if (cred === undefined) {
    var result
    var sql = "SELECT host,port,db_name,name,user,password,secure,db_type,is_database FROM AnsibleForms.`credentials` WHERE name REGEXP ?"
    var res = await mysql.do(sql,name)
    if(res.length>0){
      result = res[0]
    }else if(fallbackName){
      res = await mysql.do(sql,fallbackName)
      if(res.length>0){
        result = res[0]
      }
    }

    if(result){
      if(result.is_database){
        result.multipleStatements = true
      }else{
        delete result.secure
        delete result.db_name
        delete result.db_type
        delete result.is_database
      }
      
      try{
        result.password = decrypt(result.password)
      }catch(e){
        logger.error("Failed to decrypt the password.  Did the secretkey change ?")
        result.password = ""
      }
      cache.set(name,result)
      logger.debug("Caching credentials " + name + " from database")
      return JSON.parse(JSON.stringify(result))      
    }else{
      throw new Error("No credential found with filter " + name)
    }

  }else{
    // logger.debug("returning credentials " + name + " from cache")
    return cred
  }
};

module.exports= Credential;
