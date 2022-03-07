const logger=require("../lib/logger");
var keygen = require('ssh-keygen');
var fs = require('fs');
var config = require('../../config/app.config')
var location = config.homeDir + '/.ssh/id_rsa';
var comment = 'info@ansibleguy.com';
var password = false; // false and undefined will convert to an empty pw
var format = 'PEM'; // default is RFC4716

if(!fs.existsSync(location)){
  keygen({
    location: location,
    comment: comment,
    password: password,
    read: true,
    format: format
  }, function(err, out){
      if(err){
        logger.error("Error creating ssh keys : " + err)
        return false
      }
      logger.warn('SSH Keys created!');
      logger.silly('private key: '+out.key);
      logger.info('public key : '+out.pubKey);
  });
}else{
  logger.warn('SSH Keys already present')
}
