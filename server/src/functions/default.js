
    // export default functions that are handy and usable with the javascrip expression field
    // expand if you need, you will to do a rebuild
const https=require('https')
const axios=require("axios")
const fs = require("fs")
const logger=require("../lib/logger");
const jq=require("node-jq")
const YAML=require("yaml")
const credentialModel = require("../models/credential.model")

exports.fnGetNumberedName=function(names,pattern,value,fillgap){
  var nr=null
  var nrsequence
  var regex
  var nrs
  var re=new RegExp("[^\#]*(\#+)[^\#]*")
  var patternmatch=re.exec(pattern)
  if(!names || !Array.isArray(names)){
    logger.warn("fnGetNumberedName, No input or no array")
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
      logger.warn("fnGetNumberedName, no pattern matches found in the list")
    	return value
    }
  }else{
    logger.warn("fnGetNumberedName, no pattern found, use ### for numbers")
	  return value
  }
}
exports.fnSum = function(a,b) { return a+b };
exports.fnMultiply = function(a,b) { return a*b };
exports.fnReadJsonFile = async function(path,jqe) {
  let result=[]
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = JSON.parse(rawdata)
    if(jqe){
      result=await jq.run(jqe, result, { input:"json",output:"json" })
    }
  }catch(e){
    logger.error("Error in fnReadJsonFile : " + e)
  }
  return result
};
exports.fnReadYamlFile = async function(path,jqe) {
  let result=[]
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = YAML.parse(rawdata)
    if(jqe){
      result=await jq.run(jqe, result, { input:"json",output:"json" })
    }
  }catch(e){
    logger.error("Error in fnReadYamlFile : " + e)
  }
  return result
};

exports.fnRestBasic = async function(action,url,body,credential,jqe,sort,map){
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })
  var axiosConfig
  if(credential){
    try{
      restCreds = await credentialModel.findByName(credential)
    }catch(e){
      logger.error(e)
    }

    axiosConfig = {
      headers: {
        Authorization:"Basic " + Buffer.from(restCreds.user + ':' + restCreds.password).toString('base64')
      },
      httpsAgent:httpsAgent

    }
  }else{
    axiosConfig = {
      httpsAgent:httpsAgent
    }
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
      result=await jq.run(jqe, result, { input:"json",output:"json" })
    }
    if(sort){
      result = eval("result.sort("+sort+")")
    }
    if(map){
      result = eval("result.map("+map+")")
    }
  }catch(e){
    logger.error("Error in fnRestBasic : " + e)
  }
  logger.silly("Basic rest result : " + JSON.stringify(result))
  return result

}

// etc
