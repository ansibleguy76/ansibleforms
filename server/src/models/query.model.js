'use strict';
const logger=require("../lib/logger")
const Credential=require("./credentials.model")
const mysql=require("../lib/mysql")

//reporter object create
var Query=function(){

};
Query.findAll = function (query,config,result) {
    logger.debug(`Running query ${query} with database ${config}`)
    mysql.query(config,query,null, function (err, res) {
        if(err) {
            result(null, null);
        }
        else{
            result(null, res);
        }
    });
};
module.exports= Query;
