'use strict';
const logger=require("../lib/logger")
const mysql=require("../lib/mysql")
const mssql=require("../lib/mssql")
const postgres=require("../lib/postgres")
const mongodb=require("../lib/mongodb")

//reporter object create
var Query=function(){

};
Query.findAll = function (query,config,noLog) {
  if(noLog){
    logger.info(`[${config.type}][${config.name}] Running query : noLog is applied`)
  }else{
    logger.info(`[${config.type}][${config.name}] Running query ${query}`)
  }

    if(config.type=="mssql"){  // use mssql connection lib
      return mssql.query(config.name,query)
      .then((res)=>{
        if(!noLog){
          logger.debug(`[${config.name}] query result : ${JSON.stringify(res)}`)
        }
        return res
      })
    }else if(config.type=="mysql"){  // use mysql connection lib
      return mysql.query(config.name,query)
      .then((res)=>{
        if(!noLog){
          logger.debug(`[${config.name}] query result 2 : ${JSON.stringify(res)}`)
        }
        return res
      })
    }else if(config.type=="postgres"){  // use postgres connection lib
      return postgres.query(config.name,query)
      .then((res)=>{
        if(!noLog){
          logger.debug(`[${config.name}] query result : ${JSON.stringify(res)}`)
        }
        return res
      })
    }else if(config.type=="mongodb"){  // use postgres connection lib
      return mongodb.query(config.name,query)
        .then((res)=>{
          if(!noLog){
            logger.debug(`[${config.name}] query result : ${JSON.stringify(res)}`)
          }
          return res
        })
    }else{
      return Promise.reject("Unknown database type")
    }
};
module.exports= Query;
