const fs=require('fs')
const resolve=require('path').resolve
module.exports = {
  https: (process.env.HTTPS=="1") || true,
  httpsKey:fs.readFileSync(process.env.HTTPS_KEY) || resolve('../persistent/certificates/key.pem'),
  httpsCert:fs.readFileSync(process.env.HTTPS_CERT) || resolve('../persistent/certificates/cert.pem')
};
