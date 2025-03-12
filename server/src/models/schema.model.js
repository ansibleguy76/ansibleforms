'use strict';
const logger=require("../lib/logger");
const mysql = require("./db.model")
const appConfig = require('../../config/app.config')
const fs = require('fs');

//user object create
var Schema=function(){
};

// Check if the AnsibleForms schema exists
async function checkSchema(){
  var message
  var db="AnsibleForms"
  logger.debug("checking schema " + db)
  var res = await mysql.do(`SHOW DATABASES LIKE '${db}'`)
  if(res){
    if(res.length>0){
      message=`Schema '${db}' is present`
      logger.debug(message)
      return message
    }else{
      message=`Schema '${db}' is not present`
      logger.warning(message)
      var err = new Error(message)
      err.result = {message:[message],data:{success:[],failed:[message]}}
      throw err
    }
  }
}

// Check if a table exists
async function checkTable(table){
  var message
  var db="AnsibleForms"
  logger.debug("checking table " + table)
  var sql = `SHOW TABLES FROM ${db} WHERE Tables_in_${db}='${table}'`
  var res = await mysql.do(sql)

  if(res.length>0){
    message=`Table '${table}' is present`
    logger.debug(message)
    return message
  }else{
    message=`Table '${table}' is not present`
    logger.warning(message)
    throw new Error(message)
  }
}

// PATCHING : add a column to a table
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

// PATCHING : Add a table to the schema
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

// PATCHING : Set the charset of a column to utf8mb4
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

async function patchVersion4(messages,success,failed){

  var buffer
  var sql

  // patches to db for v4.x.x
  // Before version 4.0.0, the schema was not utf8mb4, so we need to change the charset of some columns, due to some emoticons or utf16 characters
  // Also the ldap was enhanced for openLDAP and required some additional columns
  await checkPromise(setUtf8mb4CharacterSet("jobs","extravars","longtext"),messages,success,failed) // allow emoticon or utf16 character
  await checkPromise(setUtf8mb4CharacterSet("jobs","notifications","longtext"),messages,success,failed) // allow emoticon or utf16 character
  await checkPromise(setUtf8mb4CharacterSet("jobs","approval","longtext"),messages,success,failed) // allow emoticon or utf16 character
  await checkPromise(setUtf8mb4CharacterSet("job_output","output","longtext"),messages,success,failed) // allow emoticon or utf16 character
  await checkPromise(addColumn("ldap","groups_search_base","varchar(250)",true,"NULL"),messages,success,failed) // add column to have groups search base
  await checkPromise(addColumn("ldap","groups_attribute","varchar(250)",false,"'memberOf'"),messages,success,failed) // add column to have groups attribute
  await checkPromise(addColumn("ldap","group_class","varchar(250)",true,"NULL"),messages,success,failed) // add column to have group class
  await checkPromise(addColumn("ldap","group_member_attribute","varchar(250)",true,"NULL"),messages,success,failed) // add column to have group member attribute
  await checkPromise(addColumn("ldap","group_member_user_attribute","varchar(250)",true,"NULL"),messages,success,failed) // add column to have group member user attribute
  await checkPromise(addColumn("ldap","is_advanced","tinyint(4)",true,"0"),messages,success,failed) // is advanced config
  await checkPromise(addColumn("ldap","mail_attribute","varchar(250)",true,"NULL"),messages,success,failed) // add column to have mail attribute
  // also the settings tables was not present before 4.0.0, it contains the URL and mail settings for notification
  // later the column forms_yaml was added to store the forms in yaml format (but that was in 5.x.x)
  buffer = fs.readFileSync(`${__dirname}/../db/create_settings_table.sql`)
  sql = buffer.toString()
  await checkPromise(addTable("settings",sql),messages,success,failed) // add settings table  

}

// PATCHING : Patch All
async function patchVersion5(messages,success,failed){

  var buffer
  var sql

  // patches to db for v5.x.x
  // Before version 5, the users didn't have an email.  The was on request
  // AF passes the user object and the email address can then be used in ansible for notifications
  await checkPromise(addColumn("users","email","varchar(250)",true,"NULL"),messages,success,failed) // add column to have email

  // Azure AD integration was added in 5.0.0, so we need to add the table and columns
  buffer = fs.readFileSync(`${__dirname}/../db/create_azuread_table.sql`)
  sql = buffer.toString()
  await checkPromise(addTable("azuread",sql),messages,success,failed) // add azuread table    

  // A bit later, the groupfilter was added to limit the groups that can be used in AF, because the list can be very long and that's part of the JWT token
  // which introduced a limit 
  await checkPromise(addColumn("azuread","groupfilter","varchar(250)",true,"NULL"),messages,success,failed)  // add column to limit azuread groups  

  // on request, the awx_id was added to the jobs table, to later retrieve it for future tracking
  await checkPromise(addColumn("jobs","awx_id","int(11)",true,"NULL"),messages,success,failed) // add for future tracking

  // patch for awx credentials, the use_credentials was added to the awx table, to allow the use of credentials
  await checkPromise(addColumn("awx","use_credentials","tinyint(4)",true,"0"),messages,success,failed) // bugfix for awx credentials   

  // A new feature was added, the repositories table, to store the repositories for the forms and playbooks
  // A real gamechanger, because now the forms and playbooks can be stored in a git repository
  buffer = fs.readFileSync(`${__dirname}/../db/create_repositories_table.sql`)
  sql = buffer.toString()
  await checkPromise(addTable("repositories",sql),messages,success,failed) // add repositories table

  // In a first pull requests, mdaug was so kind to contribute the oidc table, to have OpenID Connect integration
  buffer = fs.readFileSync(`${__dirname}/../db/create_oidc_table.sql`)
  sql = buffer.toString()
  await checkPromise(addTable("oidc",sql),messages,success,failed) // add oidc table 

  // In 5.0.3, the settings was extended with a new column, forms_yaml, to store the forms in yaml format
  // If you use GIT to store the forms, but not the master forms.yaml, you can now store it in the database
  
  await checkPromise(addColumn("settings","forms_yaml","longtext",true,"NULL"),messages,success,failed)  // add forms_yaml column
  await checkPromise(setUtf8mb4CharacterSet("settings","forms_yaml","longtext"),messages,success,failed) // allow emoticon or utf16 characters

  // In 5.0.8, the repositories table was extended with a new column, branch, to store the branch of the repository
  await checkPromise(addColumn("repositories","branch","varchar(250)",true,"NULL"),messages,success,failed) // add branch column

  // In 5.0.9, A new feature was added, the datasource_schemas table, to store the datasource schemas
  buffer = fs.readFileSync(`${__dirname}/../db/create_datasource_tables.sql`)
  sql = buffer.toString()
  await checkPromise(addTable("datasource",sql),messages,success,failed) // add datasource_schemas table

  // In 5.0.9, We add a scheduler
  buffer = fs.readFileSync(`${__dirname}/../db/create_schedule_table.sql`)
  sql = buffer.toString()
  await checkPromise(addTable("schedule",sql),messages,success,failed) // add datasource_schemas table


}

// PATCHING : Patch All
async function patchAll(messages,success,failed){

  var buffer
  var sql

  await checkPromise(patchVersion4(messages,success,failed),messages,success,failed)
  await checkPromise(patchVersion5(messages,success,failed),messages,success,failed)

}
async function checkPromise(promise,messages,success,failed){
  try{
    var res = await promise
    messages.push(res)
    success.push(res)
  }catch(e){
    messages.push(e.message)
    failed.push(e.message)
  }
}

async function checkTables(tables,messages,success,failed){

  for(var i=0;i<tables.length;i++){
    await checkPromise(checkTable(tables[i]),messages,success,failed)
  }

}

async function checkAll(){
  var messages=[]
  var success=[]
  var failed=[]
  var resultobj=undefined

  // check the database
  await checkPromise(checkSchema(),messages,success,failed)

  if(failed.length>0){
    // if schema does not exist, we can't check the tables // throw now
    resultobj={message:messages,data:{success:success,failed:failed}}
    var err = new Error(messages.toString())
    err.result = resultobj
    throw err
  }

  // check all the tables
  var tables=["credentials","groups","job_output","jobs","ldap","tokens","users","awx"]
  await checkPromise(checkTables(tables,messages,success,failed),messages,success,failed)

  if(failed.length>0){
    // some of the tables are missing, we can't patch them // throw now
    resultobj={message:messages,data:{success:success,failed:failed}}
    var err = new Error(messages.toString())
    err.result = resultobj
    throw err
  }

  // patch the tables
  await checkPromise(patchAll(messages,success,failed),messages,success,failed)

  if(failed.length>0){
    // some of the patches failed // throw now
    resultobj={message:messages,data:{success:success,failed:failed}}
    var err = new Error(messages.toString())
    err.result = resultobj
    throw err
  }

  // all passed fine
  resultobj={message:messages,data:{success:success,failed:failed}}
  return resultobj
}
Schema.hasSchema = function(){
  return checkAll()
}
Schema.create = async function () {
  logger.notice(`Trying to create database schema 'AnsibleForms' and tables`)
  if(appConfig.allowSchemaCreation){ // added in 5.0.3
    const buffer=fs.readFileSync(`${__dirname}/../db/create_schema_and_tables.sql`)
    const query=buffer.toString();
    var res = await mysql.do(query)
    if(res.length > 0){
      logger.notice(`Created schema 'AnsibleForms' and tables`)
      return `Created schema 'AnsibleForms' and tables`
    }else{
      var err = new Error(`Failed to create schema 'AnsibleForms' and/or tables`)
      throw err
    }

  }else{
    throw new Error(`Schema creation is disabled`)
  }
};

module.exports= Schema;

// function addRecord(table,names,values){
//   var message
//   var db="AnsibleForms"
//   logger.debug("checking record in table " + table)
//   var checksql = `SELECT * FROM ${db}.${table}`
//   var sql = `INSERT INTO ${db}.${table}(${names.join(",")}) VALUES(${values.join(",")});`
//   return mysql.do(checksql)
//     .then((checkres)=>{
//       if(checkres.length==0){
//         return mysql.do(sql)
//       }
//       return false
//     })
//     .then((res)=>{
//       if(!res){
//         message=`Record in '${table}' is present`
//         logger.debug(message)
//         return message
//       }
//       message=`added record in '${table}'`
//       logger.warning(message)
//       return message
//     })
// }

// function dropIndex(table,index){
//   var message
//   var db="AnsibleForms"
//   logger.debug(`dropping index '${index}' on table '${table}'`)
//   var checksql = `SHOW INDEX FROM ${db}.${table} WHERE Key_name='${index}'`
//   var sql = `DROP INDEX \`PRIMARY\` ON ${db}.${table}`
//   return mysql.do(checksql)
//     .then((checkres)=>{
//       if(checkres.length>0){
//         return mysql.do(sql)
//       }
//       return false
//     })
//     .then((res)=>{
//       if(!res){
//         message=`Index '${index}' is already dropped on '${table}'`
//         logger.debug(message)
//         return message
//       }
//       message=`Index '${index}' dropped on '${table}'`
//       logger.warning(message)
//       return message
//     })
// }
// function renameColumn(table,name,newname,fieldtype){
//   var message
//   var db="AnsibleForms"
//   var checksql = `SHOW COLUMNS FROM ${db}.${table} WHERE Field='${newname}'`
//   var sql = `ALTER TABLE ${db}.${table} CHANGE \`${name}\` \`${newname}\` ${fieldtype}`
//   logger.debug(`rename column '${name}'->'${newname}' on table '${table}'`)
//   return mysql.do(checksql)
//     .then((checkres)=>{
//       if(checkres.length==0){
//         return mysql.do(sql)
//       }
//       return false
//     })
//     .then((res)=>{
//       if(!res){
//         message=`Column '${name}' is already present on '${table}'`
//         logger.debug(message)
//         return message
//       }
//       message=`renamed column '${name}'->'${newname}' on '${table}'`
//       logger.warning(message)
//       return message
//     })
// }
// function resizeColumn(table,name,fieldtype){
//   var message
//   var db="AnsibleForms"
//   var checksql = `SHOW COLUMNS FROM ${db}.${table} WHERE Field='${name}' and type='${fieldtype}'`
//   var sql = `ALTER TABLE ${db}.${table} MODIFY \`${name}\` ${fieldtype}`
//   logger.debug(`resize column '${name}'->'${fieldtype}' on table '${table}'`)
//   return mysql.do(checksql)
//     .then((checkres)=>{
//       if(checkres.length==0){
//         return mysql.do(sql)
//       }
//       return false
//     })
//     .then((res)=>{
//       if(!res){
//         message=`Column '${name}' has already correct size on '${table}'`
//         logger.debug(message)
//         return message
//       }
//       message=`resized column '${name}'->'${fieldtype}' on '${table}'`
//       logger.warning(message)
//       return message
//     })
// }