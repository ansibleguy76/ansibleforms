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
function handleError(n){
  logger.error(n)
  throw(n)
}

function checkSchema(){
  var message
  var db="AnsibleForms"
  logger.debug("checking schema " + db)
  var sql = `SHOW DATABASES LIKE '${db}'`
  return new Promise((resolve,reject) => {
      mysql.query(sql,null,function(err,res){
        if(err){
          message=`Schema '${db}' query error\n` + err
          logger.warning(message)
          reject("ERROR : " + message)
        }else{
          if(res){
            if(res.length>0){
              message=`Schema '${db}' is present`
              logger.debug(message)
              resolve(message)
            }else{
              message=`Schema '${db}' is not present`
              logger.warning(message)
              reject(message)
            }
          }else{
            message=`ERROR : Unexpected result from MySql when searching for schema '${db}'`
            logger.error(message)
            reject(message)
          }
        }
      })
  })
}
function dropIndex(table,index){
  var message
  var db="AnsibleForms"
  logger.debug(`dropping index '${index}' on table '${table}'`)
  var checksql = `SHOW INDEX FROM ${db}.${table} WHERE Key_name='${index}'`
  var sql = `DROP INDEX \`PRIMARY\` ON ${db}.${table}`
  return new Promise((resolve,reject) => {
      mysql.query(checksql,null,function(checkerr,checkres){
        if(checkerr){
          message=`index '${index}' check failed on '${table}'\n` + checkerr
          logger.error(checkerr)
          reject(message)
        }else{
          if(checkres.length>0){
            mysql.query(sql,null,function(err,res){
              if(err){
                message=`index '${index}' drop failed on '${table}'\n` + err
                logger.error(message)
                reject(message)
              }else{
                if(res){
                  message=`Index '${index}' dropped on '${table}'`
                  logger.warning(message)
                  resolve(message)
                }else{
                  message=`ERROR : Unexpected result from MySql when dropping index '${index}' from table '${table}'`
                  reject(message)
                }
              }
            })
          }else{
            message=`Index '${index}' is already dropped on '${table}'`
            logger.info(message)
            resolve(message)
          }
        }
      })
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
  return new Promise((resolve,reject) => {
      mysql.query(checksql,null,function(checkerr,checkres){
        if(checkerr){
          message=`add column '${name}' check failed on '${table}'\n` + checkerr
          logger.error(checkerr)
          reject(message)
        }else{
          if(checkres.length==0){
            mysql.query(sql,null,function(err,res){
              if(err){
                message=`add column '${name}' failed on '${table}'\n` + err
                logger.error(message)
                reject(message)
              }else{
                if(res){
                  message=`added column '${name}' on '${table}'`
                  logger.warning(message)
                  resolve(message)
                }else{
                  message=`ERROR : Unexpected result from MySql when adding column '${name}' on table '${table}'`
                  reject(message)
                }
              }
            })
          }else{
            message=`Column '${name}' is already present on '${table}'`
            logger.info(message)
            resolve(message)
          }
        }
      })
  })
}
function addTable(table,sql){
  var message
  var db="AnsibleForms"
  var checksql = `SHOW TABLES FROM ${db} WHERE Tables_in_${db}='${table}'`
  logger.debug(`adding table '${table}'`)
  return new Promise((resolve,reject) => {
      mysql.query(checksql,null,function(checkerr,checkres){
        if(checkerr){
          message=`add table '${table}' check failed\n` + checkerr
          logger.error(checkerr)
          reject(message)
        }else{
          if(checkres.length==0){
            mysql.query(sql,null,function(err,res){
              if(err){
                message=`add table '${table}' failed\n` + err
                logger.error(message)
                reject(message)
              }else{
                if(res){
                  message=`added table '${table}'`
                  logger.warning(message)
                  resolve(message)
                }else{
                  message=`ERROR : Unexpected result from MySql when adding table '${table}'`
                  reject(message)
                }
              }
            })
          }else{
            message=`Table '${table}' is already present`
            logger.info(message)
            resolve(message)
          }
        }
      })
  })
}
function renameColumn(table,name,newname,fieldtype){
  var message
  var db="AnsibleForms"
  var checksql = `SHOW COLUMNS FROM ${db}.${table} WHERE Field='${newname}'`
  var sql = `ALTER TABLE ${db}.${table} CHANGE \`${name}\` \`${newname}\` ${fieldtype}`
  logger.debug(`rename column '${name}'->'${newname}' on table '${table}'`)
  return new Promise((resolve,reject) => {
      mysql.query(checksql,null,function(checkerr,checkres){
        if(checkerr){
          message=`rename column '${name}'->'${newname}' check failed on '${table}'\n` + checkerr
          logger.error(checkerr)
          reject(message)
        }else{
          if(checkres.length==0){
            mysql.query(sql,null,function(err,res){
              if(err){
                message=`rename column '${name}'->'${newname}' failed on '${table}'\n` + err
                logger.error(message)
                reject(message)
              }else{
                if(res){
                  message=`renamed column '${name}'->'${newname}' on '${table}'`
                  logger.warning(message)
                  resolve(message)
                }else{
                  message=`ERROR : Unexpected result from MySql when renaming column '${name}'->'${newname}' on table '${table}'`
                  reject(message)
                }
              }
            })
          }else{
            message=`Column '${name}' is already present on '${table}'`
            logger.info(message)
            resolve(message)
          }
        }
      })
  })
}
function checkTable(table){
  var message
  var db="AnsibleForms"
  logger.debug("checking table " + table)
  var sql = `SHOW TABLES FROM ${db} WHERE Tables_in_${db}='${table}'`
  return new Promise((resolve,reject) => {
      mysql.query(sql,null,function(err,res){
        if(err){
          message=`Table '${table}' query error\n` + err
          logger.debug(err)
          reject("ERROR : " + message)
        }else{
          if(res){
            if(res.length>0){
              message=`Table '${table}' is present`
              logger.info(message)
              resolve(message)
            }else{
              message=`Table '${table}' is not present`
              logger.warning(message)
              reject(message)
            }
          }else{
            message=`ERROR : Unexpected result from MySql when searching for table '${table}'`
            reject(message)
          }
        }
      })
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
  tablePromises.push(addColumn("jobs","approval","mediumtext",true,"NULL")) // add for approval info
  tablePromises.push(addColumn("jobs","parent_id","int(11)",true,"NULL")) // add for multistep
  tablePromises.push(renameColumn("jobs","playbook","target","VARCHAR(250)")) // better column name
  tablePromises.push(addColumn("jobs","step","varchar(250)",true,"NULL")) // add column to hold current step
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
Schema.hasSchema = function(result){
  checkAll()
    .then((res)=>{
      result(null,{status:"success",message:"Schema and tables are ok",data:res.data}) // fail
    })
    .catch((res)=>{
      if(typeof res=="object"){ // actual schema issue
        result(null,{status:"error",message:"Schema and/or tables are not ok",data:res.data}) // fail
      }else{
        result(res,null) // fail (db connect ?)
      }
    }).catch((e)=>{
      logger.error(e)
    }) // final catch
}
Schema.create = function (result) {
  logger.notice(`Trying to create database schema 'AnsibleForms' and tables`)
  const buffer=fs.readFileSync(`${__dirname}/../db/create_schema_and_tables.sql`)
  const query=buffer.toString();
  mysql.query(query,null, function (err, res) {
    if(err) {
      result(err, null);
    }
    else{
      if(res.length > 0){
        logger.notice(`Created schema 'AnsibleForms' and tables`)
        result(null,`Created schema 'AnsibleForms' and tables`)
      }else{
        result(`Failed to create schema 'AnsibleForms' and/or tables`,null)
      }
    }
  });
};

module.exports= Schema;
