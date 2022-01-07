'use strict';
const bcrypt = require('bcrypt');
const logger=require("../lib/logger");
const mysql = require("./db.model")
const fs = require('fs');
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
function checkAll(){
  var messages=[]
  var success=[]
  var failed=[]
  var tablePromises=[]
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
          return {message:messages,data:{success:success,failed:failed}} // return success
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
    }).catch((e)=>{logger.error(e)}) // final catch
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
