const Certinfo=require("cert-info")
const restResult=require("../models/restResult.model")
const logger=require("./logger")
const config=require("../../config/app.config")
var Helpers = function(){

}

// this is needed because ldap-authentication has missing try catch
Helpers.checkCertificateBase64=function(cert){
  var b64 = cert.replace(/(\r\n|\n|\r)/gm, "").replace(/\-{5}[^\-]+\-{5}/gm,"").replaceAll(" ","")
  return (Buffer.from(b64, 'base64').toString('base64') === b64)
}

Helpers.getError=function(err){
  if(err){
    if(err.message){
      return err.message
    }else{
      if(typeof err == 'string'){
        return err
      }else{
        return 'Could not extract error from err object'
      }
    }
  }else{
    return undefined
  }
}

Helpers.escapeStringForCommandLine=function(value) {
  const escaped = value.replace(/'/g, "\\'")
  return escaped;
}

Helpers.checkCertificate=function(cert){
  certs=cert.replace(/-----(\r\n|\n|\r)-----/gm,"-----|-----").split("|")
  if(certs.length>1){
    logger.debug("Certificate is a bundle...")
  }else{
    logger.debug("Certificate is single...")
  }
  for(let i=0;i<certs.length;i++){
    logger.debug(`Certificate ${i+1}`)
    var c=certs[i]
    logger.debug(c)
    if(!Helpers.checkCertificateBase64(c)){
      logger.error("Bad Base64 Encoding...")
      return false
    }else{
      logger.debug("Base64 is valid...")
      try{
        var tmp
        tmp = Certinfo.info(c)
        logger.debug(JSON.stringify(tmp))
      }catch(e){
        logger.error("Certificate cannot be parsed...")
        return false
      }
    }
  };
  // we parsed all certificates, no errors found
  return true
}
// a middleware in the routes to check if use is administrator
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
// checks for passwords from credentials and masks them
Helpers.logSafe = (v)=>{
  if(!v){
    return ""
  }
  return v.replace(/"password":"[^"]+"/g,'"password":"**NOLOG**"')
}
// a smart object placeholder replacer
Helpers.replacePlaceholders = (msg,extravars)=>{
  if(!msg)return ""
  return msg.replace(
    /\$\(([^\)]+)\)/g,
    (placeholderWithDelimiters, placeholderWithoutDelimiters) =>
      Helpers.findExtravar(extravars,placeholderWithoutDelimiters) || placeholderWithDelimiters
  );
}
Helpers.findExtravar =(data,expr)=>{
  // convert expr into actual data
  // svm.lif.ipaddress => data["svm"]["lif"]["ipaddress"]
  // using reduce, which is a recursive function
  var outputValue=""
  // outputValue=expr.split(/\s*\.\s*/)
  expr.split(/\s*\.\s*/).reduce((master,obj, level,arr) => {
    // if last
    if (level === (arr.length - 1)){
        // the last piece we assign the value to
        try{
          outputValue=master[obj]
        }catch(e){
          outputValue=""
        }

    }else{
        // initialize first time to object
        outputValue=master
    }
    // return the result for next reduce iteration
    return master[obj]

  },data);
  return outputValue
}
Helpers.friendlyAJVError= (e,property,label,o)=>{
  const re= new RegExp(`${property}\\[([0-9]+)\\][.]*`)
  const matches = e.match(re)    
  var value = `${e}`
  var changed = false
  var result={}
  var index=-1
  var name=""
  if(matches && matches.length>1){
    index = parseInt(matches[1])
    name = o[index].name || o[index].label || (index+1)
    value = e.replace(matches[0], `${label} '${name}', `)
    changed = true
  }   

  result = {
    changed,
    value,
    index,
    name
  }
  return result
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
  var filterOutput=false
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
      }else{ // regular output stream
        if(line.match(/^\[WARNING\].*/g)){ // warnings
          previousformat="warning"
          matchfound=true
          line = "<span class='has-text-warning'>"+line+"</span>"
        }else if(line.match(/^\[ERROR\].*/g)){ // errors
          previousformat="danger"
          matchfound=true
          line = "<span class='has-text-danger'>"+line+"</span>"
        }else if(line.match(/^([A-Z\s]*)[^\*]*(\*+)$/g)){ // task line with **** // mark play / task lines as bold
          previousformat=""
          matchfound=true
          if(i>1){
            line = "<span class='has-text-weight-bold'>" + line + "</span>"
          }else{
            // it's a fresh line/// ansible output assumed
            line = "\n<span class='has-text-weight-bold'>" + line + "</span>"
          }
          // if task line matches filter regex, register this task as low
          var filter=new RegExp(config.filterJobOutputRegex,"i")
          if(line.match(filter)){
            filterOutput=true
          }else{
            filterOutput=false
          }
        }else if(line.match(/^(ok): \[([^\]]*)\].*/g)){ // mark succes lines
          matchfound=true
          previousformat="success"
          line = "<span class='has-text-success'>" + line + "</span>"
        }else if(line.match(/^(changed): \[([^\]]*)\].*/g)){ // mark change lines
          previousformat="warning"
          matchfound=true
          line = "<span class='has-text-warning'>" + line + "</span>"
        }else if(line.match(/^(skipping): \[([^\]]*)\].*/g)){ // mark skip lines
          previousformat="info"
          matchfound=true
          line = "<span class='has-text-info'>" + line + "</span>"
        }else if(!matchfound && previousformat && line && line.trim()!='\r\n' && line.trim()){ // if line continues on next line, give same format
          line = `<span class='has-text-${previousformat}'>${line}</span>`
        }else{
          if(line && line.trim()!='\r\n' && line.trim()){  // is text ? 
            line = `<span class=''>${line}</span>` // then wrap in span
          }
        }        
        // summary line ?
        if(line.match('ok=.*failed.*')){
          hide=false
          matchfound=true
          previousformat=""
          line=line.replace(/(ok=[1-9]+[0-9]*)/g, "<span class='tag is-success'>$1</span>")
                      .replace(/(changed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                      .replace(/(failed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                      .replace(/(unreachable=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                      .replace(/(skipped=[1-9]+[0-9]*)/g, "<span class='tag is-info'>$1</span>")
        }
        if(filterOutput){
          line=line.replace(/class='/g,"class='low ")
        }
      }
      lineoutput.push(line)
    }) // end line loop
    // we add a timestamp to the record
    // we push it in the intermediate output array
    lineoutput.forEach(function(el2,i){
      if(el2!="" && !addedTimestamp){ // we only add timestamp to first non-empty line
        if(el2.includes("class='low")){
          el2+=" <span class='low tag is-info is-light'>"+el.timestamp+"</span>"
        }else{
          el2+=" <span class='tag is-info is-light'>"+el.timestamp+"</span>"
        }
        
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
