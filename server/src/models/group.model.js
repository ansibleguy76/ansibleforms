'use strict';
const logger=require("../lib/logger");

//group object create
var Group=function(group){
    this.name = group.name;
};
Group.create = function (record,config, result) {
    var dbConn = require('./../../config/db.mysql.config')(config);

    logger.debug(`Creating group ${record.name}`)
    dbConn.query("INSERT INTO authentication.`groups` set ?", record, function (err, res) {
        if(err) {
            logger.error(err)
            result(err, null);
        }
        else{
            result(null, res.insertId);
        }
    });

};
Group.update = function (record,id,config, result) {
    var dbConn = require('./../../config/db.mysql.config')(config);

    logger.debug(`Updating group ${record.name}`)
    dbConn.query("UPDATE authentication.`groups` set ? WHERE name=?", [record,id], function (err, res) {
        if(err) {
            //lib/logger.error(err)
            result(err, null);
        }
        else{
            result(null, res);
        }
    });
};
Group.delete = function(id,config, result){
    var dbConn = require('./../../config/db.mysql.config')(config);
    if(id==1){
      logger.warn("Some is trying to remove the admins groups !")
      result("You cannot delete group 'admins'",null)
    }else{
      logger.debug(`Deleting group ${id}`)
      dbConn.query("DELETE FROM authentication.`groups` WHERE id = ? AND name<>'admins'", [id], function (err, res) {
          if(err) {
              logger.error(err)
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }

};
Group.findAll = function (config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    logger.debug("Finding all groups")
    var query = "SELECT * FROM authentication.`groups` limit 20;"
    try{
      dbConn.query(query, function (err, res) {
          if(err) {
              logger.error(err)
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }catch(err){
      result(err, null);
    }
};
Group.findById = function (id,config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    logger.debug(`Finding group ${id}`)
    var query = "SELECT * FROM authentication.`groups` WHERE id=?;"
    try{
      dbConn.query(query,id, function (err, res) {
          if(err) {
              logger.error(err)
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }catch(err){
      result(err, null);
    }
};

module.exports= Group;
