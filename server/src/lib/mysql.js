//- MYSQL Module
const logger = require('./logger');
try{
    var mysql = require('mysql');
}catch(err){
    logger.warn("Cannot find `mysql` module. Is it installed ? Try `npm install mysql` or `npm install`.");
}

var mySqlConnections={}

var MySql = function(){

}

//-
//- Export
//-
// use this library
function executeMySqlQuery(connection_name,query,vars,callback){
  mySqlConnections[connection_name].getConnection(function(connerr,conn){
    if(connerr){
      callback("Failed to get connection for " + connection_name + ". " + connerr,null)
    }else{
      conn.query(query,vars,function(err,result){
        conn.release()
        if(err){
          logger.error("["+connection_name+"] Failed : " + query)
          callback("Failed to query. " + err,null)
        }else{
          // logger.silly("["+connection_name+"] " + JSON.stringify(result))
          callback(null,result)
        }
      })
    }
  })
}

function getMySqlCredential(connection_name,callback){
  logger.debug("["+connection_name+"] Getting connection credentials from database")
  var query = "SELECT host,name,user,password FROM AnsibleForms.`credentials` WHERE name=?;"
  mySqlConnections["ANSIBLEFORMS_DATABASE"].getConnection(function(errconnection,connection){
    executeMySqlQuery("ANSIBLEFORMS_DATABASE",query,connection_name,function(err,result){
      if(err){
        callback(err,null)
      }else{
        if(result.length>0){
          logger.silly("["+connection_name+"] Credentials are found, creating new pool")
          result[0].multipleStatements=true
          callback(null,JSON.parse(JSON.stringify(result[0])))
        }else{
          callback("No credentials found for " + connection_name)
        }
      }
    })
  })
}

MySql.query=function(connection_name,query,vars,callback){

  // logger.silly("["+connection_name+"] Connection is requested")

  if(!mySqlConnections[connection_name]){
    logger.silly("["+connection_name+"] First time connection")
    if(connection_name !== "ANSIBLEFORMS_DATABASE"){
      try{
        getMySqlCredential(connection_name,function(errcreds,creds){
          if(errcreds){
            callback(errcreds,null)
          }else{
            mySqlConnections[connection_name]=mysql.createPool(creds)
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
      logger.silly("["+connection_name+"] Initiating default pool from environment variables")
      mySqlConnections["ANSIBLEFORMS_DATABASE"]=mysql.createPool(require("../../config/db.config"))
      executeMySqlQuery(connection_name,query,vars,function(err,result){
        if(err){
          callback(err,null)
        }else{
          callback(null,result)
        }
      })
    }
  }else{
    // logger.silly("["+connection_name+"] Getting existing pool")
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
