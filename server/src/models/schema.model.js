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
  logger.silly("checking schema " + db)
  var sql = `SHOW DATABASES LIKE '${db}'`
  return new Promise((resolve,reject) => {
      mysql.query(sql,null,function(err,res){
        if(err){
          message=`Schema '${db}' query error\n` + err
          logger.warn(message)
          reject("ERROR : " + message)
        }else{
          if(res){
            if(res.length>0){
              message=`Schema '${db}' is present`
              logger.silly(message)
              resolve(message)
            }else{
              message=`Schema '${db}' is not present`
              logger.warn(message)
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
  logger.silly(`dropping index '${index}' on table '${table}'`)
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
                  logger.warn(message)
                  resolve(message)
                }else{
                  message=`ERROR : Unexpected result from MySql when dropping index '${index}' from table '${table}'`
                  reject(message)
                }
              }
            })
          }else{
            message=`Index '${index}' is already dropped on '${table}'`
            logger.debug(message)
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
  logger.silly(`adding column '${name}' on table '${table}'`)
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
                  logger.warn(message)
                  resolve(message)
                }else{
                  message=`ERROR : Unexpected result from MySql when adding column '${name}' on table '${table}'`
                  reject(message)
                }
              }
            })
          }else{
            message=`Column '${name}' is already present on '${table}'`
            logger.debug(message)
            resolve(message)
          }
        }
      })
  })
}
function checkTable(table){
  var message
  var db="AnsibleForms"
  logger.silly("checking table " + table)
  var sql = `SHOW TABLES FROM ${db} WHERE Tables_in_${db}='${table}'`
  return new Promise((resolve,reject) => {
      mysql.query(sql,null,function(err,res){
        if(err){
          message=`Table '${table}' query error\n` + err
          logger.silly(err)
          reject("ERROR : " + message)
        }else{
          if(res){
            if(res.length>0){
              message=`Table '${table}' is present`
              logger.debug(message)
              resolve(message)
            }else{
              message=`Table '${table}' is not present`
              logger.warn(message)
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
  // patches to db for v2.1.4
  tablePromises.push(dropIndex("tokens","PRIMARY")) // drop primary ; allow multi devices
  tablePromises.push(addColumn("tokens","timestamp","datetime",false,"current_timestamp()")) // add timestamp for cleanup
  tablePromises.push(addColumn("awx","ignore_certs","tinyint(4)",true,"1")) // add for awx certficate validation
  tablePromises.push(addColumn("awx","ca_bundle","text",true,"NULL")) // add for awx certficate validation
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
        logger.silly("Patching database finished")
        if(failed.length==0){
          logger.info("Patching database successful")
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
    logger.silly("Schema check from cache")
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
            logger.silly("Schema check to cache")
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
  logger.info(`Trying to create database schema 'AnsibleForms' and tables`)
  const buffer=fs.readFileSync(`${__dirname}/../db/create_schema_and_tables.sql`)
  const query=buffer.toString();
  mysql.query(query,null, function (err, res) {
    if(err) {
      result(err, null);
    }
    else{
      if(res.length > 0){
        logger.info(`Created schema 'AnsibleForms' and tables`)
        result(null,`Created schema 'AnsibleForms' and tables`)
      }else{
        result(`Failed to create schema 'AnsibleForms' and/or tables`,null)
      }
    }
  });
};


module.exports= Schema;
