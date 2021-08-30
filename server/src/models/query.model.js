'use strict';
const logger=require("../lib/logger")

//reporter object create
var Query=function(){

};
Query.findAll = function (query,config,result) {
    logger.debug(`Running query ${query} with database ${config}`)
    var dbConn = require('./../../config/db.mysql.config')(config);
    dbConn.query(query, function (err, res) {
        if(err) {
            logger.error(err)
            result(null, err);
        }
        else{
            result(null, res);
        }
    });
};
module.exports= Query;
