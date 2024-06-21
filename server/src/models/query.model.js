'use strict';
const logger=require("../lib/logger")
const Credential=require("./credential.model")
const mysql=require("../lib/mysql")
const mssql=require("../lib/mssql")
const postgres=require("../lib/postgres")
const mongodb=require("../lib/mongodb")
const oracle=require("../lib/oracle")

//reporter object create
var Query=function(){

};
Query.findAll = async function (query,cfg,noLog) {

  // legacy config was an object
  // in 5.0.2 we allow string and array
  // dbtype is stored in the credential, so we don't need it in the config
  // hence we can allow a simple string as config
  // additinally we allow an array of strings and merge the results
  var config = []
  var result = []
  if(typeof cfg == "string"){
    config.push({})
    config[0].name = cfg
  }else if(Array.isArray(cfg)){
    // clone cfg
    cfg.forEach((c)=>{
      config.push({name:c})
    })
  }else if(typeof cfg == "object"){
    config.push(cfg)
  }


  for await (var c of config){

    var res = []
    if(!c.type){ // if no type is given, we try to find the credential
      logger.debug(`[${c.name}] No type is passed, looking up credential`)
      var cred = await Credential.findByName(c.name)
      c.type = cred.db_type || "mysql"
    }
    if(noLog){
      logger.info(`[${c.type}][${c.name}] Running query : noLog is applied`)
    }else{
      logger.info(`[${c.type}][${c.name}] Running query ${query}`)
    }        
    if(c.type=="mssql"){  // use mssql connection lib
      res = await mssql.query(c.name,query)
      if(!noLog){
        logger.debug(`[${c.name}] query result : ${JSON.stringify(res)}`)
      }
      result = result.concat(res)

    }else if(c.type=="mysql"){  // use mysql connection lib
      res = await mysql.query(c.name,query)
      if(!noLog){
        logger.debug(`[${c.name}] query result : ${JSON.stringify(res)}`)
      }
      result = result.concat(res)
    }else if(c.type=="postgres"){  // use postgres connection lib
      res = await postgres.query(c.name,query)
      if(!noLog){
        logger.debug(`[${c.name}] query result : ${JSON.stringify(res)}`)
      }
      result = result.concat(res)
    }else if(c.type=="oracle"){  // use postgres connection lib
      res = await oracle.query(c.name,query)
      if(!noLog){
        logger.debug(`[${c.name}] query result : ${JSON.stringify(res)}`)
      }
      result = result.concat(res)      
    }else if(c.type=="mongodb"){  // use postgres connection lib
      res = await mongodb.query(c.name,query)
      if(!noLog){
        logger.debug(`[${c.name}] query result : ${JSON.stringify(res)}`)
      }
      result = result.concat(res)
    }else{
      throw new Error("Unsupported database type")
    }
  }
  return result
};
module.exports= Query;
