'use strict';
const bcrypt = require('bcrypt');
const logger=require("../lib/logger");
const mysql = require("./db.model")
const fs = require('fs');
const NodeCache = require("node-cache")

const cache = new NodeCache({
    stdTTL: 14400,
    checkperiod: (14400 * 0.5)
});
//user object create
var Schema=function(){
};
function handleError(err){
  logger.error(err.toString())
  throw(err)
}

function checkSchema(){
  var message
  var db="AnsibleForms"
  logger.debug("checking schema " + db)
  return mysql.do(`SHOW DATABASES LIKE '${db}'`)
    .then((res)=>{
      if(res){
        if(res.length>0){
          message=`Schema '${db}' is present`
          logger.debug(message)
          return message
        }else{
          message=`Schema '${db}' is not present`
          logger.warning(message)
          throw({message:message,data:{success:"",failed:message}})
        }
      }
    })
}
function dropIndex(table,index){
  var message
  var db="AnsibleForms"
  logger.debug(`dropping index '${index}' on table '${table}'`)
  var checksql = `SHOW INDEX FROM ${db}.${table} WHERE Key_name='${index}'`
  var sql = `DROP INDEX \`PRIMARY\` ON ${db}.${table}`
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length>0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Index '${index}' is already dropped on '${table}'`
        logger.debug(message)
        return message
      }
      message=`Index '${index}' dropped on '${table}'`
      logger.warning(message)
      return message
    })
}
function addColumn(table,name,fieldtype,nullable,defaultvalue){
  var message
  var db="AnsibleForms"
  var checksql = `SHOW COLUMNS FROM ${db}.${table} WHERE Field='${name}'`
  var sql = `ALTER TABLE ${db}.${table} ADD COLUMN ${name} ${fieldtype}`
  if(!nullable){
    sql+=' NOT NULL'
  }
  if(defaultvalue){
    sql+=` DEFAULT ${defaultvalue}`
  }
  logger.debug(`adding column '${name}' on table '${table}'`)
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length==0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Column '${name}' is already present on '${table}'`
        logger.debug(message)
        return message
      }
      message=`added column '${name}' on '${table}'`
      logger.warning(message)
      return message
    })
}
function addTable(table,sql){
  var message
  var db="AnsibleForms"
  var checksql = `SHOW TABLES FROM ${db} WHERE Tables_in_${db}='${table}'`
  logger.debug(`adding table '${table}'`)
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length==0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Table '${table}' is already present`
        logger.debug(message)
        return message
      }
      message=`added table '${table}'`
      logger.warning(message)
      return message
    })
}
function renameColumn(table,name,newname,fieldtype){
  var message
  var db="AnsibleForms"
  var checksql = `SHOW COLUMNS FROM ${db}.${table} WHERE Field='${newname}'`
  var sql = `ALTER TABLE ${db}.${table} CHANGE \`${name}\` \`${newname}\` ${fieldtype}`
  logger.debug(`rename column '${name}'->'${newname}' on table '${table}'`)
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length==0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Column '${name}' is already present on '${table}'`
        logger.debug(message)
        return message
      }
      message=`renamed column '${name}'->'${newname}' on '${table}'`
      logger.warning(message)
      return message
    })
}
function resizeColumn(table,name,fieldtype){
  var message
  var db="AnsibleForms"
  var checksql = `SHOW COLUMNS FROM ${db}.${table} WHERE Field='${name}' and type='${fieldtype}'`
  var sql = `ALTER TABLE ${db}.${table} MODIFY \`${name}\` ${fieldtype}`
  logger.debug(`resize column '${name}'->'${fieldtype}' on table '${table}'`)
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length==0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Column '${name}' has already correct size on '${table}'`
        logger.debug(message)
        return message
      }
      message=`resized column '${name}'->'${fieldtype}' on '${table}'`
      logger.warning(message)
      return message
    })
}
function setUtf8mb4CharacterSet(table,name,fieldtype){
  var message
  var db="AnsibleForms"
  var checksql = `SELECT 1 FROM information_schema.columns WHERE table_schema='${db}' AND table_name = '${table}' AND column_name = '${name}' AND character_set_name='utf8mb4';`
  var sql = `ALTER TABLE ${db}.${table} MODIFY \`${name}\` ${fieldtype} character set utf8mb4 collate utf8mb4_unicode_ci;`
  logger.debug(`set charset column '${name}'->'utf8mb4' on table '${table}'`)
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length==0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Column '${name}' has already charset 'utf8mb4' on '${table}'`
        logger.debug(message)
        return message
      }
      message=`Changed charset to 'utf8mb4' on column '${name}' on '${table}'`
      logger.warning(message)
      return message
    })
}
function addRecord(table,names,values){
  var message
  var db="AnsibleForms"
  logger.debug("checking record in table " + table)
  var checksql = `SELECT * FROM ${db}.${table}`
  var sql = `INSERT INTO ${db}.${table}(${names.join(",")}) VALUES(${values.join(",")});`
  return mysql.do(checksql)
    .then((checkres)=>{
      if(checkres.length==0){
        return mysql.do(sql)
      }
      return false
    })
    .then((res)=>{
      if(!res){
        message=`Record in '${table}' is present`
        logger.debug(message)
        return message
      }
      message=`added record in '${table}'`
      logger.warning(message)
      return message
    })
}
function checkTable(table){
  var message
  var db="AnsibleForms"
  logger.debug("checking table " + table)
  var sql = `SHOW TABLES FROM ${db} WHERE Tables_in_${db}='${table}'`
  return mysql.do(sql)
    .then((res)=>{
      if(res.length>0){
        message=`Table '${table}' is present`
        logger.debug(message)
        return message
      }else{
        message=`Table '${table}' is not present`
        logger.warning(message)
        throw({message:message,data:{success:"",failed:message}})
      }
    })

}
function reflect(promise){
    return promise.then(function(v){ return {v:v, status: "fulfilled" }},
                        function(e){ return {e:e, status: "rejected" }});
}
function patchAll(){
  var messages=[]
  var success=[]
  var failed=[]
  var tablePromises=[]
  var buffer
  var sql
  // patches to db for v2.1.4
  tablePromises.push(dropIndex("tokens","PRIMARY")) // drop primary ; allow multi devices
  tablePromises.push(addColumn("tokens","timestamp","datetime",false,"current_timestamp()")) // add timestamp for cleanup
  tablePromises.push(addColumn("awx","ignore_certs","tinyint(4)",true,"1")) // add for awx certficate validation
  tablePromises.push(addColumn("awx","ca_bundle","text",true,"NULL")) // add for awx certficate validation
  tablePromises.push(addColumn("jobs","job_type","varchar(20)",true,"NULL")) // add for git addition
  tablePromises.push(addColumn("jobs","extravars","mediumtext",true,"NULL")) // add for extravars
  tablePromises.push(addColumn("jobs","credentials","mediumtext",true,"NULL")) // add for credentials
  tablePromises.push(addColumn("jobs","notifications","mediumtext",true,"NULL")) // add for notifications
  tablePromises.push(addColumn("jobs","approval","mediumtext",true,"NULL")) // add for approval info
  tablePromises.push(addColumn("jobs","parent_id","int(11)",true,"NULL")) // add for multistep
  tablePromises.push(renameColumn("jobs","playbook","target","VARCHAR(250)")) // better column name
  tablePromises.push(addColumn("jobs","step","varchar(250)",true,"NULL")) // add column to hold current step
  tablePromises.push(addColumn("credentials","secure","tinyint(4)",true,"0")) // add column to have secure connection
  tablePromises.push(addColumn("credentials","is_database","tinyint(4)",true,"1")) // add column to set credentials as database creds
  tablePromises.push(addColumn("credentials","db_type","varchar(10)",true,"NULL")) // add column to have db type
  tablePromises.push(addColumn("credentials","db_name","varchar(255)",true,"NULL")) // add column to have db type
  tablePromises.push(addColumn("awx","username","varchar(255)",true,"NULL")) // add column to have user based awx connection
  tablePromises.push(addColumn("awx","password","text",true,"NULL")) // add column to have user based awx connection
  tablePromises.push(addColumn("awx","use_credentials","tinyint(4)",false,"0")) // add column to have user based awx connection
  tablePromises.push(resizeColumn("tokens","username_type","VARCHAR(10)")) // azuread is longer
  // patches to db for v4.0.10
  tablePromises.push(setUtf8mb4CharacterSet("jobs","extravars","longtext")) // allow emoticon or utf16 character
  tablePromises.push(setUtf8mb4CharacterSet("jobs","notifications","longtext")) // allow emoticon or utf16 character
  tablePromises.push(setUtf8mb4CharacterSet("jobs","approval","longtext")) // allow emoticon or utf16 character
  tablePromises.push(setUtf8mb4CharacterSet("job_output","output","longtext")) // allow emoticon or utf16 character
  // patches to db for v4.0.20
  tablePromises.push(addColumn("ldap","groups_search_base","varchar(250)",true,"NULL")) // add column to have groups search base  
  tablePromises.push(addColumn("ldap","groups_attribute","varchar(250)",false,"'memberOf'")) // add column to have groups attribute  
  tablePromises.push(addColumn("ldap","group_class","varchar(250)",true,"NULL")) // add column to have group class
  tablePromises.push(addColumn("ldap","group_member_attribute","varchar(250)",true,"NULL")) // add column to have group member attribute
  tablePromises.push(addColumn("ldap","group_member_user_attribute","varchar(250)",true,"NULL")) // add column to have group member user attribute
  tablePromises.push(addColumn("ldap","is_advanced","tinyint(4)",true,"0")) // is advanced config
  // patches to db for v5.0.1
  tablePromises.push(addColumn("ldap","mail_attribute","varchar(250)",true,"NULL")) // add column to have mail attribute
  tablePromises.push(addColumn("users","email","varchar(250)",true,"NULL")) // add column to have email
  buffer = fs.readFileSync(`${__dirname}/../db/create_settings_table.sql`)
  sql = buffer.toString()
  tablePromises.push(addTable("settings",sql)) // add settings table
  
  buffer = fs.readFileSync(`${__dirname}/../db/create_azuread_table.sql`)
  sql = buffer.toString()
  tablePromises.push(addTable("azuread",sql)) // add azuread table

  buffer = fs.readFileSync(`${__dirname}/../db/create_repositories_table.sql`)
  sql = buffer.toString()
  tablePromises.push(addTable("repositories",sql)) // add azuread table  

  tablePromises.push(addColumn("azuread","groupfilter","varchar(250)",true,"NULL"))  // add column to limit azuread groups
  //tablePromises.push(addRecord("settings",["mail_server","mail_port","mail_secure","mail_username","mail_password","mail_from","url"],["''",25,0,"''","''","''","''"]))
  // buffer=fs.readFileSync(`${__dirname}/../db/create_settings_table.sql`)
  // sql=buffer.toString();
  // tablePromises.push(addTable("settings",sql)) // add new table for overriding env variables
  return Promise.all(tablePromises.map(reflect))
    .then((results)=>{ // all table results are back
        // separate success from failed
        results.map(x => {
          if(x.status === "fulfilled")
            success.push(x.v)
          if(x.status === "rejected")
            failed.push(x.e)
        })
        messages=messages.concat(success).concat(failed); // overal message
        logger.debug("Patching database finished")
        if(failed.length==0){
          logger.notice("Patching database successful")
          return Promise.resolve(messages) // return success
        }else {
          return Promise.reject(failed) // throw failed
        }
      },
      handleError
    )
}
function checkAll(){
  var messages=[]
  var success=[]
  var failed=[]
  var tablePromises=[]
  var resultobj=undefined
  resultobj=cache.get('result')  // get from cache, we only check the schema once (or once a day)
  if(resultobj){
    logger.debug("Schema check from cache")
    return Promise.resolve(resultobj)
  }
  return checkSchema() // schema
    .then((res)=>{     // if success
      messages.push(res); // add schema result
      success.push(res);  // add schema success
      // check all tables as promise
      tablePromises.push(checkTable("credentials"))
      tablePromises.push(checkTable("groups"))
      tablePromises.push(checkTable("job_output"))
      tablePromises.push(checkTable("jobs"))
      tablePromises.push(checkTable("ldap"))
      tablePromises.push(checkTable("tokens"))
      tablePromises.push(checkTable("users"))
      tablePromises.push(checkTable("awx"))
      // tablePromises.push(checkTable("settings"))
      // wait for all results
      return Promise.all(tablePromises.map(reflect)) // map succes status
    },handleError) // stop if schema does not exist or other error (db connect failed ?)
    .then((results)=>{ // all table results are back
        // separate success from failed
        results.map(x => {
          if(x.status === "fulfilled")
            success.push(x.v)
          if(x.status === "rejected")
            failed.push(x.e)
        })
        messages=messages.concat(success).concat(failed); // overal message
        if(failed.length==0){
          return patchAll().then((res)=>{
            messages=messages.concat(res)
            success=success.concat(res)
            logger.debug("Schema check to cache")
            resultobj={message:messages,data:{success:success,failed:failed}}
            cache.set('result',resultobj)
            return resultobj // return success
          }).catch((res)=>{
            messages=messages.concat(res)
            failed=failed.concat(res)
            throw({message:messages,data:{success:"",failed:failed}}) // throw failed
          })
        }else {
          throw({message:messages,data:{success:success,failed:failed}}) // throw failed
        }
      },
      handleError
    )
}
Schema.hasSchema = function(){
  return checkAll()
}
Schema.create = function () {
  logger.notice(`Trying to create database schema 'AnsibleForms' and tables`)
  const buffer=fs.readFileSync(`${__dirname}/../db/create_schema_and_tables.sql`)
  const query=buffer.toString();
  return mysql.do(query)
    .then((res)=>{
      if(res.length > 0){
        logger.notice(`Created schema 'AnsibleForms' and tables`)
        return `Created schema 'AnsibleForms' and tables`
      }else{
        throw {message:`Failed to create schema 'AnsibleForms' and/or tables`,data:{success:"",failed:`Failed to create schema 'AnsibleForms' and/or tables`}}
      }
    })
};

module.exports= Schema;
