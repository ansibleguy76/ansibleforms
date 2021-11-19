const certinfo=require("cert-info")
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

module.exports = Helpers
