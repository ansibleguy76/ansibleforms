const fs=require('fs')
const logger=require("../src/lib/logger");
var privatekey=undefined
var certificate=undefined

if(process.env.HTTPS=="1"){
  try{
    privatekey = fs.readFileSync(process.env.HTTPS_KEY || (__dirname + '/../persistent/certificates/key.pem'))
    certificate = fs.readFileSync(process.env.HTTPS_CERT || (__dirname + '/../persistent/certificates/cert.pem'))
  }catch(err){
    logger.error("Failed to open https private key and certificate : ",err)
    throw new Error("Failed to open https private key and certificate : " + err.message)
  }
}

module.exports = {
  https: (process.env.HTTPS=="1") || false,
  httpsKey:privatekey,
  httpsCert:certificate
};
