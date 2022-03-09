'use strict';
const logger=require("../lib/logger");
const config=require("../../config/app.config")
const fs=require("fs")
const path=require("path")
const keygen = require('../lib/ssh-keygen');
const location = path.join(config.homePath,'/.ssh/id_rsa');
const pubkeylocation = path.join(config.homePath,'/.ssh/id_rsa.pub');

// constructor for ssh config
var Ssh=function(ssh){
    this.key = ssh.key;
};

Ssh.generate = function(force,result){
  keygen({
    location: location,
    read: true,
    force: force,
    destroy: false,
    comment: 'info@ansibleguy.com',
    password: false,
    read: true,
    size: '2048',
    format: 'PEM'
  }, function onDoneCallback(err, out){
      if(err){
        logger.error("Error creating ssh keys : " + err)
        return false
      }
      logger.warn('SSH Keys created!');
      logger.silly('private key : '+out.key);
      logger.info('public key : '+out.pubKey);
  })
}

//ssh object create (it's an update; during schema creation we add a record)
Ssh.update = function (record, result) {
    logger.debug(`Updating ssh key`)
    try{
      // write new key
      fs.writeFileSync(location,record.key,{mode:0o600})
      // logger.info("Updated ssh private key")
      // generate public key
      // logger.debug(`Generating ssh public key`)
      keygen({
        publicOnly: true,
        location: location,
        read: true,
        force: true,
        destroy: false
      }, (err, out)=>{
          if(err){
            logger.error("Error creating public ssh key : " + err)
            result(err)
            return false
          }else{
            logger.info('Public SSH Key created!');
            logger.silly('public key : '+out.pubKey);
            result(null,true)
          }
      });

    }catch(e){
      logger.error(e)
      fs.rmSync(location,true)
      fs.rmSync(pubkeylocation,true)
      result(e)
    }
};
// get ssh config from database
Ssh.find = function (result) {
  var key
  var pubkey=''
  try{
    logger.debug("Reading sshkey key")
    keygen({
      randomArt: true,
      location: location
    }, (err, out)=>{
        if(err){
          logger.error(err)
          result(err)
          return false
        }else{
          // logger.silly("Private key found")
          try{
            // logger.silly("Reading public key")
            pubkey=fs.readFileSync(pubkeylocation).toString()
            // logger.silly("Public key found")
          }catch(e){
            //
          }
          result(null,{art:out.art,publicKey:pubkey})
        }
    });

  }catch(e){
    logger.error(e)
    result(e)
  }

};
module.exports= Ssh;
