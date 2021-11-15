//- MYSQL Module
const logger = require('./logger');
const {decrypt} = require('./crypto')
const NodeCache = require('node-cache')
const dbConfig = require('../../config/db.config')
const mysql = require('mysql');


const mySqlPools = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});

var MySql = function(){

}
function getPool(name,connectionConfig){
  var pool
  // get pool from cache
  pool = mySqlPools.get(name)
  // not in cache ?
  if(pool==undefined){
    logger.silly("["+name+"] unknown, creating new")
    // is it the default connection, create from config
    if(name=="ANSIBLEFORMS_DATABASE"){
      logger.silly("["+name+"] is default pool, creating from db config")
      connectionConfig=dbConfig
    }
    connectionConfig.multipleStatements=true
    connectionConfig.connectionLimit=20
    // logger.silly("["+name+"] creating pool")
    pool = mysql.createPool(connectionConfig)
    // save in cache
    // logger.silly("["+name+"] caching pool")
    mySqlPools.set(name,pool)
  }
  return pool
}
//-
//- Export
//-
// use this library
function executeMySqlQuery(connection_name,query,vars,callback){
  logger.silly("query : " + query)
  logger.silly("["+connection_name+"] Getting connection")
  mySqlPools.get(connection_name).getConnection(function(connerr,conn){
    if(connerr){
      callback("Failed to get connection for " + connection_name + ". " + connerr,null)
    }else{
      // logger.silly("get connection")
      conn.query(query,vars,function(err,result){
        if(err){
          logger.error("["+connection_name+"] Failed : " + query)
          callback("Failed to query. " + err,null)
        }else{
          logger.silly("["+connection_name+"] " + JSON.stringify(result))
          callback(null,result)
        }
        logger.silly("query done ; releasing connection")
        conn.release()
      })
    }
  })
}

function getMySqlCredential(connection_name,callback){
  logger.debug("["+connection_name+"] Getting connection credentials from database")
  var query = "SELECT host,name,user,password FROM AnsibleForms.`credentials` WHERE name=?;"
  getPool("ANSIBLEFORMS_DATABASE").getConnection(function(errconnection,connection){
    executeMySqlQuery("ANSIBLEFORMS_DATABASE",query,connection_name,function(err,res){
      if(err){
        callback(err,null)
      }else{
        if(res.length>0){
          logger.silly("["+connection_name+"] Credentials are found")
          try{
            res[0].password = decrypt(res[0].password)
          }catch(e){
            logger.error("Failed to decrypt the password.  Did the secretkey change ?")
            res[0].password = ""
          }
          callback(null,JSON.parse(JSON.stringify(res[0])))
        }else{
          callback("No credentials found for " + connection_name)
        }
      }
    })
  })
}

MySql.query=function(connection_name,query,vars,callback){

  logger.silly("["+connection_name+"] Connection is requested, trying cache")
  var defaultPool = getPool("ANSIBLEFORMS_DATABASE",null)
  if(mySqlPools.get(connection_name)==undefined){
    logger.silly("["+connection_name+"] First time connection")
    if(connection_name !== "ANSIBLEFORMS_DATABASE"){
      try{
        getMySqlCredential(connection_name,function(errcreds,creds){
          if(errcreds){
            callback(errcreds,null)
          }else{
            var pool = getPool(connection_name,creds)
            executeMySqlQuery(connection_name,query,vars,function(err,result){
              if(err){
                callback(err,null)
              }else{
                callback(null,result)
              }
            })
          }
        })
      }catch(err){
        callback(err, null);
      }
    }else{
      executeMySqlQuery(connection_name,query,vars,function(err,result){
        if(err){
          callback(err,null)
        }else{
          callback(null,result)
        }
      })
    }
  }else{
    logger.silly("["+connection_name+"] Using existing pool from cache")
    executeMySqlQuery(connection_name,query,vars,function(err,result){
      if(err){
        callback(err,null)
      }else{
        callback(null,result)
      }
    })
  }
};
module.exports = MySql
