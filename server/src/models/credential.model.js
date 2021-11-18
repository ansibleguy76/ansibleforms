'use strict';
const logger=require("../lib/logger");
const mysql=require("../lib/mysql");
const {encrypt,decrypt}=require("../lib/crypto")
const NodeCache = require("node-cache")

const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});


//credential object create
var Credential=function(credential){
    this.name = credential.name;
    this.host = credential.host;
    this.port = credential.port;
    this.user = credential.user;
    this.password = encrypt(credential.password);
    this.description = credential.description;
};

Credential.create = function (record, result) {
    logger.debug(`Creating credential ${record.name}`)
    mysql.query("ANSIBLEFORMS_DATABASE","INSERT INTO AnsibleForms.`credentials` set ?", record, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res.insertId);
        }
    });

};
Credential.update = function (record,id, result) {
    logger.debug(`Updating credential ${record.name}`)
    mysql.query("ANSIBLEFORMS_DATABASE","UPDATE AnsibleForms.`credentials` set ? WHERE id=?", [record,id], function (err, res) {
        if(err) {
            //lib/logger.error(err)
            result(err, null);
        }
        else{
            cache.del(record.name)
            result(null, res);
        }
    });
};
Credential.delete = function(id, result){
    if(id==1){
      logger.warn("Some is trying to remove the admins credentials !")
      result("You cannot delete credential 'admins'",null)
    }else{
      logger.debug(`Deleting credential ${id}`)
      mysql.query("ANSIBLEFORMS_DATABASE","DELETE FROM AnsibleForms.`credentials` WHERE id = ? AND name<>'admins'", [id], function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }

};
Credential.findAll = function (result) {
    logger.debug("Finding all credentials")
    var query = "SELECT * FROM AnsibleForms.`credentials` limit 20;"
    try{
      mysql.query("ANSIBLEFORMS_DATABASE",query, function (err, res) {
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
Credential.findById = function (id,result) {
    logger.debug(`Finding credential ${id}`)
    var query = "SELECT * FROM AnsibleForms.`credentials` WHERE id=?;"
    try{
      mysql.query("ANSIBLEFORMS_DATABASE",query,id, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
          if(res.length>0){
            try{
              res[0].password = decrypt(res[0].password)
            }catch(e){
              logger.error("Failed to decrypt the password.  Did the secretkey change ?")
              res[0].password = ""
            }

            result(null, res);
          }else{
            result("No credential found named " + name,null)
          }
        }
      });
    }catch(err){
      result(err, null);
    }
};
Credential.findByName = function (name) {
    return new Promise((resolve,reject) => {
      try{
        logger.silly(`Finding credential ${name}`)
        var cred = cache.get(name)
        if(cred==undefined){
          var query = "SELECT host,port,name,user,password FROM AnsibleForms.`credentials` WHERE name=?;"
          mysql.query("ANSIBLEFORMS_DATABASE",query,name, function (err, res) {
              if(err) {
                  reject(err,null);
              }
              else{
                  if(res.length>0){
                    // a bit special here.  We will pass the full object as a mysql connect object,
                    // so we convert the DataRowPacket to normal javascript object.  We also remove array.
                    // we also assume we find the credential, hence we throw an error if it's not found.
                    res[0].multipleStatements = true
                    try{
                      res[0].password = decrypt(res[0].password)
                    }catch(e){
                      logger.error("Failed to decrypt the password.  Did the secretkey change ?")
                      res[0].password = ""
                    }
                    cache.set(name,res[0])
                    logger.silly("Caching credentials " + name + " from database")
                    resolve(JSON.parse(JSON.stringify(res[0])))
                  }else{
                    reject(new Error("No credential found named " + name),null)
                  }
              }
          });
        }else{
          // logger.silly("returning credentials " + name + " from cache")
          resolve(cred)
        }
      }catch(err){
        reject(err)
      }
    })

};

module.exports= Credential;
