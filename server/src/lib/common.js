const certinfo=require("cert-info")
const restResult=require("../models/restResult.model")
const logger=require("./logger")
var Helpers = function(){

}

// this is needed because ldap-authentication has missage try catch
Helpers.checkCertificateBase64=function(cert){
  var b64 = cert.replace(/(\r\n|\n|\r)/gm, "").replace(/\-{5}[^\-]+\-{5}/gm,"")
  return (Buffer.from(b64, 'base64').toString('base64') === b64)
}

Helpers.checkCertificate=function(cert){
  if(!Helpers.checkCertificateBase64(cert)){
    return false
  }else{
    try{
      var tmp
      tmp = certinfo.info(cert)
      return true
    }catch(e){
      return false
    }
  }
}
Helpers.checkAdminMiddleware = (req, res, next) =>  {
      try{
        if(!req.user.user.roles.includes("admin")) {
          res.status(401).json(new restResult("error","you are not an admin"))
        } else {
          //logger.silly("You are admin, access to user management")
          next()
        }
      }catch(e){
        res.status(401).json(new restResult("error","you are not an admin"))
      }
}
Helpers.logSafe = (v)=>{
  if(!v){
    return ""
  }
  return v.replace(/"password":"[^"]+"/g,'"password":"**NOLOG**"')
}

module.exports = Helpers
