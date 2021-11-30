'use strict';
const logger=require("../lib/logger")
const mysql=require("../lib/mysql")
const sql=require("../lib/sql")
const postgres=require("../lib/postgres")

//reporter object create
var Query=function(){

};
Query.findAll = function (query,config,result) {

    logger.silly(`[${config.type}][${config.name}] Running query ${query}`)
    if(config.type=="mssql"){  // use mssql connection lib
      sql.query(config.name,query, function (err, res) {
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
    }

};
module.exports= Query;
