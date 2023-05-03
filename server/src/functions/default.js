
    // export default functions that are handy and usable with the javascrip expression field
    // expand if you need, you will to do a rebuild
const https=require('https')
const axios=require("axios")
const fs = require("fs")
const logger=require("../lib/logger");
const jq=require("node-jq")
const YAML=require("yaml")
const {exec} = require('child_process');
const {inspect} = require('node:util')
const _ = require("lodash")
const {firstBy,thenBy}=require("thenby")
const ip=require("ip")
const dayjs=require("dayjs")
const credentialModel = require("../models/credential.model")
// import definitions as strings
require.extensions['.definitions'] = function (module, filename) {
    module.exports = fs.readFileSync(filename, 'utf8');
};
// import jq definitions
var jqDef = require("./jq.definitions");
const Helpers = require('../lib/common');
jqDef+= require("./jq.custom.definitions")
jqDef=jqDef.replace(/(\r\n|\n|\r)/gm, "");
logger.debug("jq definitions loaded : " + jqDef)

exports.fnGetNumberedName=function(names,pattern,value,fillgap=false){
  var nr=null
  var nrsequence
  var regex
  var nrs
  var re=new RegExp("[^\#]*(\#+)[^\#]*")
  var patternmatch=re.exec(pattern)
  if(!names || !Array.isArray(names)){
    logger.warning("fnGetNumberedName, No input or no array")
    return value
  }
  if(patternmatch && patternmatch.length==2){
  	nrsequence=patternmatch[1]
	  regex="^" + pattern.replace(nrsequence,"([0-9]{"+nrsequence.length+"})") + "$"
    nrs=names.map((item)=>{
      var regexp=new RegExp(regex,"g");
      var matches=regexp.exec(item)
      if(matches && matches.length==2){
        return parseInt(matches[1])
      }else{
        null
      }
    }).filter((item)=>(item))
    var gaps=nrs.reduce(function(acc, cur, ind, arr) {
      var diff = cur - arr[ind-1];
      if (diff > 1) {
        var i = 1;
        while (i < diff) {
          acc.push(arr[ind-1]+i);
          i++;
        }
      }
      return acc;
    }, []);
    var max=(nrs.length>0)?Math.max(...nrs):null
    var gap=(gaps.length>0)?Math.min(...gaps):null
    if(max){
      nr=max+1
    }
    if(fillgap && gap){
      nr=gap
    }
    if(nr){
      var tmp = pattern.replace(nrsequence,nr.toString().padStart(nrsequence.length,"0"))
      return tmp
    }else{
      logger.warning("fnGetNumberedName, no pattern matches found in the list")
    	return value
    }
  }else{
    logger.warning("fnGetNumberedName, no pattern found, use ### for numbers")
	  return value
  }
}
exports.fnCidr=function(i,n){
  return ip.subnet(i,n)
}
exports.fnTime=function(d){
  if(d==undefined){
    return dayjs()
  }else{
    return dayjs(d)
  }
}
exports.fnJq=async function(input,jqe){
    const jq = require('node-jq')
    let result=undefined
    if(!jqe){
      logger.warning("[fnJq] jq is empty")
      return result
    }
    try{
      result=await jq.run(jqDef+jqe, input, { input:"json",output:"json" })
    }catch(e){
      logger.error("Error in fnJq : " + e)
    }
    return result
}
exports.fnCopy=function(input){
    return input
},
exports.fnSort=function(input,sort){
  let result=input
  if(!Array.isArray(input)){
    logger.warning("Warning in fnSort : input is not an array")
    return result
  }
  if(!sort){
    logger.warning("Warning in fnSort : sort list not provided")
    return result
  }
  logger.debug("[fnSort] sorting result")
  // force sort to array
  var o = [].concat(sort || [])
  // convert sort to thenBy values
  var order=o.map((e)=>{
          var ks,k,v,t
          t=typeof e
          // if string, return the string
          if(t=="string")return [e]
          // if object
          if(t=="object"){
              // get keys
              ks=Object.keys(e)
              // if empty object, return empty
              if(!ks)return []
              // get first key
              k=(ks)[0];
              // get value of key
              v=e[k];
              // empty key : flat array ; use 0
              if(k=="")k=0
              // if value if empty, return key, otherwise return key and value
              return (v)?[k,v]:[k]
          }
      })
  // console.log(order)
  var first = order[0]
  var rest = order.slice(1)
  let s = rest.reduce((a, e) => a.thenBy(...e), firstBy(...first));
  try{
    result.sort(s)
  }catch(e){
    logger.error("[fnSort] error in fnSort")
  }
  return result
}
exports.fnReadJsonFile = async function(path,jqe=null) {
  if(!path)return undefined
  let result=undefined
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = JSON.parse(rawdata)
    if(jqe){
      result=await jq.run(jqDef+jqe, result, { input:"json",output:"json" })
    }
  }catch(e){
    logger.error("Error in fnReadJsonFile : " + e)
  }
  return result
};
exports.fnReadYamlFile = async function(path,jqe=null) {
  if(!path)return undefined
  let result=undefined
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = YAML.parse(rawdata)
    if(jqe){
      result=await jq.run(jqDef+jqe, result, { input:"json",output:"json" })
    }
  }catch(e){
    logger.error("Error in fnReadYamlFile : " + e)
  }
  return result
};
exports.fnCredentials = async function(name){
  var result=undefined
  if(name){
    try{
      result = await credentialModel.findByName(name)
    }catch(e){
      logger.error(e)
    }
  }
  return result
}
exports.fnRestBasic = async function(action,url,body,credential=null,jqe=null,sort=null){
  var headers={}
  if(credential){
    try{
      restCreds = await exports.fnCredentials(credential)
    }catch(e){
      logger.error(e)
    }
    headers.Authorization="Basic " + Buffer.from(restCreds.user + ':' + restCreds.password).toString('base64')
  }
  return await exports.fnRestAdvanced(action,url,body,headers,jqe,sort)
}
exports.fnRestAdvanced = async function(action,url,body,headers={},jqe=null,sort=null){
  if(!action || !url){
    logger.warning("[fnRest] No action or url defined")
    return undefined
  }
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })
  var axiosConfig = {
    headers: {},
    httpsAgent:httpsAgent
  }
  if(typeof headers=="object"){
    axiosConfig.headers=headers
  }

  let result=[]
  try{
    if(action=="get"){
      data = await axios.get(url,axiosConfig);
    }else if(action=="post"){
      data = await axios.post(url,body,axiosConfig);
    }else if(action=="delete"){
      data = await axios.post(url,axiosConfig);
    }else if(action=="put"){
      data = await axios.put(url,body,axiosConfig);
    }
    result=data.data
    if(jqe){
      result=await jq.run(jqDef+jqe, result, { input:"json",output:"json" })
    }
    if(sort)result=exports.fnSort(result,sort)
  }catch(e){
    logger.error("Error in fnRestAdvanced : " + e)
  }
  return result

}
exports.fnRestJwt = async function(action,url,body,token,jqe=null,sort=null){
  var headers={}
  if(token){
    headers.Authorization="Bearer " + token
  }
  return await exports.fnRestAdvanced(action,url,body,headers,jqe,sort)
}
exports.fnRestJwtSecure = async function(action,url,body,tokenname,jqe=null,sort=null){
  var headers={}
  if(tokenname){
    var token = await exports.fnCredentials(tokenname)
    headers.Authorization="Bearer " + token.password
  }
  return await exports.fnRestAdvanced(action,url,body,headers,jqe,sort)
}
exports.fnSsh = async function(user,host,cmd,jqe=null){

  result= await new Promise((resolve,reject)=>{
    const u=user.replaceAll('"','\"') // escape quote in user to avoid code injection
    const h=host.replaceAll('"','') // remove quote in host to avoid code injection
    const c=cmd.replace('"','\"') // escape quote in command to avoid code injection
    const command=`ssh "${u}"@${h} "${c}"`
    logger.debug(`invoking ssh : ${command}`)
    var child = exec(command,{encoding: "UTF-8"});
    var output=[]
    
    // add output eventlistener to the process to save output
    child.stdout.on('data',function(data){
      // save the output ; but whilst saving, we quickly check the status to detect abort
      data.split(/\r?\n/).forEach(element => {
        output.push(element)
      });
    })
    // add error eventlistener to the process to save output
    child.stderr.on('data',function(data){
      // save the output ; but whilst saving, we quickly check the status to detect abort
      data.split(/\r?\n/).forEach(element => {
        output.push(element)
      });
    })
    // add exit eventlistener to the process to handle status update
    child.on('exit',function(data){
      output.push(`exit(${data})`)

      resolve(output)
    })
    // add error eventlistener to the process; set failed
    child.on('error',function(data){
      output.push(Helpers.getError())
      logger.error(inspect(data))
      reject(output)
    })  
  })
  if(jqe){
    result=await jq.run(jqDef+jqe, result, { input:"json",output:"json" })
  }
  return result

}
// etc
