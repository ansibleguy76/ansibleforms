'use strict';
const logger=require("../lib/logger")
const mysql=require("../lib/mysql")
const mssql=require("../lib/mssql")
const postgres=require("../lib/postgres")
const mongodb=require("../lib/mongodb")

//reporter object create
var Query=function(){

};
Query.findAll = function (query,config,result) {

    logger.silly(`[${config.type}][${config.name}] Running query ${query}`)
    if(config.type=="mssql"){  // use mssql connection lib
      mssql.query(config.name,query, function (err, res) {
          if(err) {
              result(null, null);
          }
          else{
              result(null, res);
          }
      });
    }else if(config.type=="mysql"){  // use mysql connection lib
      mysql.query(config.name,query, function (err, res) {
          if(err) {
              result(null, null);
          }
          else{
              result(null, res);
          }
      });
    }else if(config.type=="postgres"){  // use postgres connection lib
      postgres.query(config.name,query, function (err, res) {
          if(err) {
              result(null, null);
          }
          else{
              result(null, res);
          }
      });
    }else if(config.type=="mongodb"){  // use postgres connection lib
      mongodb.query(config.name,query, function (err, res) {
          if(err) {
              result(null, null);
          }
          else{
              result(null, res);
          }
      });
    }

};
module.exports= Query;
