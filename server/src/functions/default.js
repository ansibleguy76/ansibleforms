// Core Node.js modules
import fs from "fs";
import fsPromises from 'fs/promises';
import path from 'path';
import dns from 'dns';
import https from 'https';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { inspect } from 'node:util';

// Third-party modules
import axios from "axios";
import jq from "node-jq";
import yaml from "yaml";
import JSONbig from 'json-bigint';
import dayjs from "dayjs";
import thenbypkg from "thenby";

const { firstBy } = thenbypkg;

// Project-specific modules
import logger from "../lib/logger.js";
import ip from "../lib/ip.js";
import credentialModel from "../models/credential.model.js";
import Helpers from '../lib/common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jqDef = await fsPromises.readFile(path.join(__dirname, 'jq.definitions'), 'utf8');
const jqCustomDef = await fsPromises.readFile(new URL('./jq.custom.definitions', import.meta.url), 'utf8');

const combinedJqDef = (jqDef + jqCustomDef).replace(/(\r\n|\n|\r)/gm, "");
logger.debug("jq definitions loaded : " + combinedJqDef)

const fnGetNumberedName=function(names,pattern,value,fillgap=false){
  var nr=null
  var nrsequence
  var regex
  var nrs
  var re=new RegExp("[^\#]*(\#+)[^\#]*")
  var patternmatch=re.exec(pattern)
  if(!names || !Array.isArray(names)){
    const e = "[fnGetNumberedName] No input or no array"
    logger.warning(e)
    throw(new Error(e))
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
      const e = "fnGetNumberedName, no pattern matches found in the list"
      logger.warning(e)
    	return value
    }
  }else{
    const e = "fnGetNumberedName, no pattern found, use ### for numbers"
    logger.warning(e)
	  return value
  }
}
const fnCidr=function(i,n){
  return ip.subnet(i,n)
}
const fnTime=function(d){
  if(d==undefined){
    return dayjs()
  }else{
    return dayjs(d)
  }
}
const fnJq=async function(input,jqe){
    let result=undefined
    if(!jqe){
      logger.warning("[fnJq] jq is empty")
      return result
    }
    try{
      result=await jq.run(combinedJqDef+jqe, input, { input:"json",output:"json" })
    }catch(e){
      logger.error("Error in fnJq : ",e)
      throw(e)
    }
    return result
}
const fnCopy=function(input){
    return input
}

const fnSort=function(input,sort){
  let result=input
  if(!Array.isArray(input)){
    const e = "Warning in fnSort : input is not an array"
    logger.warning(e)
    throw(new Error(e))
  }
  if(!sort){
    const e = "Warning in fnSort : sort list not provided"
    logger.warning(e)
    throw(new Error(e))
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
    logger.error("[fnSort] error in fnSort : ",e)
    throw(e)
  }
  return result
}
const fnReadJsonFile = async function(path,jqe=null) {
  if(!path)return undefined
  let result=undefined
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = JSON.parse(rawdata)
    if(jqe){
      result=await jq.run(combinedJqDef+jqe, result, { input:"json",output:"json" })
    }
  }catch(e){
    logger.error("Error in fnReadJsonFile : ",e)
    throw(e)
  }
  return result
};
const fnReadYamlFile = async function(path,jqe=null) {
  if(!path)return undefined
  let result=undefined
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = yaml.parse(rawdata)
    if(jqe){
      result=await jq.run(combinedJqDef+jqe, result, { input:"json",output:"json" })
    }
  }catch(e){
    logger.error("Error in fnReadYamlFile : ",e)
    throw(e)
  }
  return result
};
const fnDnsResolve = async function(hostname,type) {
  logger.debug("[fnDnsResolve] dns resolve is happening")
  return new Promise((resolve,reject) => {
    dns.resolve(hostname,type,(err,addresses) => {
      if (err) {
        reject(err)
      } else {
        resolve(addresses)
      }
    })
  })
}
const fnCredentials = async function(name,fallbackname=""){
  var result=undefined
  if(name){
    try{
      result = await credentialModel.findByName(name,fallbackname)
      // console.log(result)
    }catch(e){
      logger.error("Error getting credentials",e)
      throw(e)
    }
  }
  return result
}
const fnRestBasic = async function(action,url,body,credential=null,jqe=null,sort=null,hasBigInt=false){
  var headers={}
  if(credential){
    const restCreds = await fnCredentials(credential)
    headers.Authorization="Basic " + Buffer.from(restCreds.user + ':' + restCreds.password).toString('base64')
  }
  return await fnRestAdvanced(action,url,body,headers,jqe,sort,hasBigInt)
}
const fnRestAdvanced = async function(action,url,body,headers={},jqe=null,sort=null,hasBigInt=false,raw=false){
  if(!action || !url){
    const e = "[fnRest] No action or url defined"
    logger.warning(e)
    throw(new Error(e))
  }
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })
  var axiosConfig = {
    headers: {},
    httpsAgent:httpsAgent
  }
  if(hasBigInt){
    logger.debug("Using bigint transform")
    axiosConfig.transformResponse = (data => JSONbig.parse(data) )
  }

  // added in 5.0.10
  if (headers && typeof headers === "object") {
    for (const key in headers) {

      if (typeof headers[key] === "string") {
        // logger.debug(`[fnRestAdvanced] processing header ${key} with value ${headers[key]}`);
        let m;
        // basic(credential_name)
        if ((m = headers[key].match(/base64\(([^)]+)\)/i))) {
          // logger.debug(`[fnRestAdvanced] base64 encoding for header ${key} with credential ${m[1]}`);
          const cred = await fnCredentials(m[1]);
          if (cred && cred.user && cred.password) {
            headers[key] = headers[key].replace(/base64\(([^)]+)\)/i,Buffer.from(cred.user + ":" + cred.password).toString("base64"))
          }
        }
        // password(credential_name)
        else if ((m = headers[key].match(/password\(([^)]+)\)/i))) {
          // logger.debug(`[fnRestAdvanced] password substitution for header ${key} with credential ${m[1]}`);
          const cred = await fnCredentials(m[1]);
          if (cred && cred.password) {
            headers[key]=headers[key].replace(/password\([^)]+\)/i, cred.password);
          }
        }
        // username(credential_name)
        else if ((m = headers[key].match(/username\(([^)]+)\)/i))) {
          // logger.debug(`[fnRestAdvanced] username substitution for header ${key} with credential ${m[1]}`);
          const cred = await fnCredentials(m[1]);
          if (cred && cred.user) {
            headers[key]=headers[key].replace(/username\([^)]+\)/i, cred.user);
          }
        }
      }
    }
  }

  // logger.debug(`[fnRestAdvanced] action: ${action}, url: ${url}, body: ${JSON.stringify(body)}, headers: ${JSON.stringify(headers)}`)

  if(typeof headers=="object"){
    axiosConfig.headers=headers
  }

  let result=[]
  let data=null
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
    if(raw) return {data:data.data,response_headers:data.headers} // return raw data
    result=data.data
    if(jqe){
      result=await jq.run(combinedJqDef+jqe, result, { input:"json",output:"json" })
    }
    if(sort)result=fnSort(result,sort)
  }catch(e){
    logger.error("Error in fnRestAdvanced : ",e)
    throw(e)
  }
  return result

}
const fnRestJwt = async function(action,url,body,token,jqe=null,sort=null,hasBigInt=false,tokenPrefix="Bearer"){
  var headers={}
  if(token){
    headers.Authorization=tokenPrefix + " " + token
  }
  return await fnRestAdvanced(action,url,body,headers,jqe,sort,hasBigInt)
}
const fnRestJwtSecure = async function(action,url,body,tokenname,jqe=null,sort=null,hasBigInt=false,tokenPrefix="Bearer"){
  var headers={}
  if(tokenname){
    var token = await fnCredentials(tokenname)
    headers.Authorization=tokenPrefix + " " + token.password
  }
  return await fnRestAdvanced(action,url,body,headers,jqe,sort,hasBigInt)
}
const fnSsh = async function(user,host,cmd,jqe=null){

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
    result=await jq.run(combinedJqDef+jqe, result, { input:"json",output:"json" })
  }
  return result

}
// etc
export default {
  fnGetNumberedName,
  fnCidr,
  fnTime,
  fnJq,
  fnCopy,
  fnSort,
  fnReadJsonFile,
  fnReadYamlFile,
  fnDnsResolve,
  fnCredentials,
  fnRestBasic,
  fnRestAdvanced,
  fnRestJwt,
  fnRestJwtSecure,
  fnSsh
};
