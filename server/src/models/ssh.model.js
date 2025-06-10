'use strict';
import logger from "../lib/logger.js";
import config from "../../config/app.config.js";
import fs from "fs";
import path from "path";
import ssh_keygen from "../lib/ssh-keygen.js";
const privateKeyPath = path.join(config.homePath, '/.ssh/id_rsa');
const publicKeyPath = path.join(config.homePath, '/.ssh/id_rsa.pub');

// constructor for ssh config
var Ssh=function(ssh){
    this.key = ssh.key;
};
// generate new keys (used only once during startup of ansibleforms (in the init/index.js))
Ssh.generate = function(force){
  return ssh_keygen.keygen({
    path: privateKeyPath,
    read: true,
    force: force,
    destroy: false,
    comment: 'info@ansibleguy.com',
    password: false,
    read: true,
    size: '2048',
    format: 'PEM'
  })
  .then((keys)=>{
    logger.warning('SSH Keys created!');
    logger.debug('private key : '+keys.key);
    logger.notice('public key : '+keys.pubKey);
  })
}

// it allows a manual upload of a custom private key
// the public key is then auto generated
Ssh.update = function (record) {
    logger.info(`Updating ssh key`)
    try{
      // write new private key
      fs.writeFileSync(privateKeyPath,record.key,{mode:0o600})
      // autogenerate new public key
      return ssh_keygen.keygen({
        publicOnly: true,
        path: privateKeyPath,
        read: true,
        force: true,
        destroy: false
      })
      .then((keys)=>{
        logger.notice('Public SSH Key created!');
        logger.debug('public key : '+keys.pubKey);
      })
      .catch((err)=>{
        logger.error("Error creating public key "+err)
      })

    }catch(e){
      logger.error(e)
      fs.rmSync(privateKeyPath,true)
      fs.rmSync(publicKeyPath,true)
      throw e
    }
};
// get private & public key info
Ssh.find = function () {
  var key
  var pubkey=''

  logger.info("Reading sshkey key")
  return ssh_keygen.keygen({              // get random art for private key
    randomArt: true,
    path: privateKeyPath
  })
  .then((out)=>{
    // logger.debug("Private key found")
    return fs.promises.readFile(publicKeyPath)  // read public key
      .then((pubkey)=>{
        return {art:out.art,publicKey:pubkey.toString()}
      })
      .catch((e)=>{
        logger.error("No public key found")
        return Promise.resolve({art:out.art,publicKey:""})
      })

  })

};
export default  Ssh;
