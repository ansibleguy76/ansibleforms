const fs=require('fs')

module.exports = {
  https: (process.env.HTTPS=="1"),
  httpsKey:fs.readFileSync(process.env.HTTPS_KEY),
  httpsCert:fs.readFileSync(process.env.HTTPS_CERT)
};
