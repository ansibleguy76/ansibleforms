const fs=require('fs')
const logger=require("../src/lib/logger");
module.exports = {
  https: (process.env.HTTPS=="1") || false,
  httpsKey:fs.readFileSync(process.env.HTTPS_KEY || (__dirname + '/../persistent/certificates/key.pem')),
  httpsCert:fs.readFileSync(process.env.HTTPS_CERT || (__dirname + '/../persistent/certificates/cert.pem'))
};
