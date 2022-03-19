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
          //logger.debug("You are admin, access to user management")
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
Helpers.formatOutput = (records,asText)=>{
  var output=[] // => is final output array
  if(asText){
      // we loop all records, we generalize all newlines to \r\n (output can be mix)
      records.forEach(function(el){
        // we first change new lines to \n
        // we split and rejoin with \r\n
        output.push(el.output.trim('\r\n').replace(/\r/g,'').split('\n').join('\r\n'))
      })
      return output.join('\r\n') // me merge all as 1 big string
  }
  // not as text, so we need to colorize
  // loop all records
  records.forEach(function(el){
    var line
    var addedTimestamp=false
    var output2=[] // => each record can still be multiple line => so this is intermediate output array
    var lineoutput=[]
    var record = el.output.trim('\r\n').replace(/\r/g,'') // => first generalize linefeeds
    var lines = record.split('\n') // => break record if multiple lines

    var previousformat="" // => a string to hold the format of a previous line in case multiline
    var matchfound=false
    lines.forEach((line,i)=>{ // loop lines
      matchfound=false // => a flag to check if previous line was changed
      if(el.output_type=="stderr"){ // if it was in the error stream
        // mark errors
        if(line.match(/^\[WARNING\].*/g) || previousformat=="warning"){ // warnings
          previousformat="warning"
          matchfound=true
          line = "<span class='has-text-warning'>"+line+"</span>"
        }else{  // errors
          previousformat="danger"
          matchfound=true
          line = "<span class='has-text-danger'>"+line+"</span>"
        }
        lineoutput.push(line)
      }else{ // regular output stream
        if(line.match(/^\[WARNING\].*/g)){ // warnings
          previousformat="warning"
          matchfound=true
          line = "<span class='has-text-warning'>"+line+"</span>"
        }
        if(line.match(/^\[ERROR\].*/g)){ // errors
          previousformat="danger"
          matchfound=true
          line = "<span class='has-text-danger'>"+line+"</span>"
        }
        // mark play / task lines as bold
        if(line.match(/^([A-Z\s]*)[^\*]*(\*+)$/g)){ // task line with ****
          previousformat=""
          matchfound=true
          if(i>1){
            line = "<strong>" + line + "</strong>"
          }else{
            // it's a fresh line/// ansible output assumed
            line = "\n<strong>" + line + "</strong>"
          }
        }
        // mark succes lines
        if(line.match(/^(ok): \[([^\]]*)\].*/g)){
          matchfound=true
          previousformat="success"
          line = "<span class='has-text-success'>" + line + "</span>"
        }
        // mark change lines
        if(line.match(/^(changed): \[([^\]]*)\].*/g)){
          previousformat="warning"
          matchfound=true
          line = "<span class='has-text-warning'>" + line + "</span>"
        }
        // mark skip lines
        if(line.match(/^(skipping): \[([^\]]*)\].*/g)){
          previousformat="info"
          matchfound=true
          line = "<span class='has-text-info'>" + line + "</span>"
        }
        // if line continues on next line, give same format
        if(!matchfound && previousformat){
          line = `<span class='has-text-${previousformat}'>${line}</span>`
        }
        // summary line ?
        if(line.match('ok=.*failed.*')){
          matchfound=true
          previousformat=""
          line=line.replace(/(ok=[1-9]+[0-9]*)/g, "<span class='tag is-success'>$1</span>")
                      .replace(/(changed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                      .replace(/(failed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                      .replace(/(unreachable=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                      .replace(/(skipped=[1-9]+[0-9]*)/g, "<span class='tag is-info'>$1</span>")
        }
        lineoutput.push(line)
      }
    }) // end line loop
    // we add a timestamp to the record
    // we push it in the intermediate output array
    lineoutput.forEach(function(el2,i){
      if(el2!="" && !addedTimestamp){ // we only add timestamp to first non-empty line
        el2+=" <span class='tag is-info is-light'>"+el.timestamp+"</span>"
        addedTimestamp=true
      }
      output2.push(el2)
    })
    // we merge the intermediate colorized output finally
    output.push(output2.join("\r\n"))
  })
  return output.join("\r\n") // return all as one nice merged string
}

module.exports = Helpers
