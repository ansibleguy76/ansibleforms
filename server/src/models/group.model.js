'use strict';
const logger=require("../lib/logger");
const mysql=require("./db.model")

//group object create
var Group=function(group){
    this.name = group.name;
};
Group.create = function (record, result) {
    logger.debug(`Creating group ${record.name}`)
    mysql.query("INSERT INTO AnsibleForms.`groups` set ?", record, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res.insertId);
        }
    });

};
Group.update = function (record,id, result) {
    logger.debug(`Updating group ${record.name}`)
    mysql.query("UPDATE AnsibleForms.`groups` set ? WHERE name=?", [record,id], function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res);
        }
    });
};
Group.delete = function(id, result){
    if(id==1){
      logger.warn("Some is trying to remove the admins groups !")
      result("You cannot delete group 'admins'",null)
    }else{
      logger.debug(`Deleting group ${id}`)
      mysql.query("DELETE FROM AnsibleForms.`groups` WHERE id = ? AND name<>'admins'", [id], function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }

};
Group.findAll = function (result) {
    logger.debug("Finding all groups")
    var query = "SELECT * FROM AnsibleForms.`groups` limit 20;"
    try{
      mysql.query(query,null, function (err, res) {
          if(err) {
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
Group.findById = function (id,result) {
    logger.debug(`Finding group ${id}`)
    var query = "SELECT * FROM AnsibleForms.`groups` WHERE id=?;"
    try{
      mysql.query(query,id, function (err, res) {
          if(err) {
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
