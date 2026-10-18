// Core Node.js modules
import fs from "fs";
import fsPromises from 'fs/promises';
import path from 'path';
import dns from 'dns';
import https from 'https';
import { spawn } from 'child_process';
import { inspect } from 'node:util';

// Third-party modules
import axios from "axios";
import yaml from "yaml";
import JSONbig from 'json-bigint';
import dayjs from "dayjs";
import thenbypkg from "thenby";

const { firstBy } = thenbypkg;

// Project-specific modules
import logger from "../lib/logger.js";
import ip from "../lib/ip.js";
import { shellQuote } from "../lib/shell.js";
import { assertUrlAllowed } from "../lib/hostfilter.js";
import credentialModel from "../models/credential.model.v2.js";
import Errors from "../lib/errors.js";
import Helpers from '../lib/common.js';
import { readSecret, mapPayloadToCredential, parseInlineSecret } from "../secrets/providers/index.js";
import { playbookEnv } from '../lib/playbookEnv.js';
import { runJq } from "../lib/jq.js";
import appConfig from "../../config/app.config.js";

// The jq definitions (jq.definitions + jq.custom.definitions) are prefixed by
// runJq (lib/jq.js), joined with newlines so a '#' comment in the custom file cannot
// swallow the filter ; runJq also bounds jq's run time (JQ_TIMEOUT_SECONDS) and output.

const fnGetNumberedName=function(names,pattern,value,fillgap=false){
  var nr=null
  var nrsequence
  var regex
  var nrs
  var re=new RegExp("[^#]*(#+)[^#]*")
  var patternmatch=re.exec(pattern)
  if(!names || !Array.isArray(names)){
    const e = "[fnGetNumberedName] No input or no array"
    logger.warning(e)
    throw(new Error(e))
  }
  if(patternmatch && patternmatch.length==2){
  	nrsequence=patternmatch[1]
	  regex="^" + pattern.replace(nrsequence,"([0-9]{"+nrsequence.length+"})") + "$"
    // the numbers already taken : 0 is a number too (a 'filter(item => item)'
    // dropped '000'), every number counts once, and they are sorted NUMERICALLY,
    // since the gap search below walks neighbours and an unsorted or duplicated list
    // made fillgap suggest a name that was already taken
    nrs=[...new Set(names.map((item)=>{
      var regexp=new RegExp(regex,"g");
      var matches=regexp.exec(item)
      if(matches && matches.length==2){
        return parseInt(matches[1],10)
      }
      return null
    }).filter((item)=>(item!=null && !Number.isNaN(item))))].sort((x,y)=>x-y)
    var gaps=nrs.reduce(function(acc, cur, ind, arr) {
      if (ind === 0) return acc;
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
    var max=(nrs.length>0)?nrs[nrs.length-1]:null
    var gap=(gaps.length>0)?gaps[0]:null
    // compared with null : a max of 0 is a real maximum
    if(max!=null){
      nr=max+1
    }
    if(fillgap && gap!=null){
      nr=gap
    }
    if(nr!=null){
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
      result=await runJq(jqe, input)
    }catch(e){
      logger.error("Error in fnJq: ",e)
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
    const e = "Warning in fnSort: input is not an array"
    logger.warning(e)
    throw(new Error(e))
  }
  if(!sort){
    const e = "Warning in fnSort: sort list not provided"
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
              // empty key : flat array ; sort on the item itself.
              // a property name (or index 0) would compare strings on their
              // first character only and numbers not at all (5[0] is undefined)
              if(k=="")k=(item)=>item
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
    logger.error("[fnSort] error in fnSort: ",e)
    throw(e)
  }
  return result
}
const fnReadJsonFile = async function(path,jqe=null) {
  if(!path)return undefined
  let result
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = JSON.parse(rawdata)
    if(jqe){
      result=await runJq(jqe, result)
    }
  }catch(e){
    logger.error("Error in fnReadJsonFile: ",e)
    throw(e)
  }
  return result
};
const fnReadYamlFile = async function(path,jqe=null) {
  if(!path)return undefined
  let result
  try{
    let rawdata = fs.readFileSync(path,'utf8');
    result = yaml.parse(rawdata)
    if(jqe){
      result=await runJq(jqe, result)
    }
  }catch(e){
    logger.error("Error in fnReadYamlFile: ",e)
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
const fnCredentials = async function(name,fallbackname="",credJqe=null){
  var result=undefined
  if(name){
    try{
      // Straight from a secret store, no credential row needed :
      //   "secret:<store>:<ref>"  e.g. "secret:cyberark:Safe=Linux;Object=root"
      //   "vault:<path>"          the store named `vault` (HashiCorp Vault)
      const inline = parseInlineSecret(name)
      if (inline) {
        const payload = await readSecret(inline.store, inline.ref)
        let projected = payload
        if (credJqe) {
          projected = await runJq(credJqe, payload)
        }
        result = mapPayloadToCredential(projected)
      } else {
        // the exact name first, with every column of the row ; then the name as a
        // regex, then the fallback - as the docs have always promised
        result = await credentialModel.findByName(name)
        if (!result) {
          try {
            result = await credentialModel.resolveCredential(name, fallbackname)
          } catch (e) {
            if (!(e instanceof Errors.NotFoundError)) throw e
            logger.warning(`fnCredentials: no credential matches '${name}'${fallbackname ? ` or '${fallbackname}'` : ""}`)
          }
        }
        if (result && credJqe) {
          // Allow callers to reshape a stored credential too (rare, but symmetric).
          result = await runJq(credJqe, result)
        }
      }
    }catch(e){
      logger.error("Error getting credentials",e)
      throw(e)
    }
  }
  return result
}
/**
 * The REST call time limit, in milliseconds, from REST_TIMEOUT_SECONDS.
 *
 * Returns:
 *   number: The limit ; 60 seconds when the setting is missing or not above 0.
 */
const restTimeoutMs = function(){
  const s = Number(appConfig.restTimeoutSeconds)
  return (s > 0 ? s : 60) * 1000
}
const fnRestBasic = async function(action,url,body,credential=null,jqe=null,sort=null,hasBigInt=false){
  var headers={}
  if(credential){
    const restCreds = await fnCredentials(credential)
    // a credential that does not exist used to crash with a TypeError on .user
    if(!restCreds){
      throw new Error(`[fnRestBasic] Credential '${credential}' not found`)
    }
    // RFC 7617: username:password must be UTF-8 encoded before base64 encoding
    // This handles special characters like :, @, and UTF-8 characters (é, ñ, 中文, etc.)
    headers.Authorization="Basic " + Buffer.from(restCreds.user + ':' + restCreds.password, 'utf8').toString('base64')
  }
  return await fnRestAdvanced(action,url,body,headers,jqe,sort,hasBigInt)
}
const fnRestAdvanced = async function(action,url,body,headers={},jqe=null,sort=null,hasBigInt=false,raw=false){
  if(!action || !url){
    const e = "[fnRest] No action or url defined"
    logger.warning(e)
    throw(new Error(e))
  }
  
  // Fix URL encoding for special characters like '+' 
  // Parse and reconstruct URL to properly encode query parameters
  try {
    const urlObj = new URL(url);
    // Re-encode query parameters to handle '+' and other special chars
    if (urlObj.search) {
      const params = new URLSearchParams(urlObj.search);
      urlObj.search = params.toString();
    }
    url = urlObj.toString();
  } catch (e) {
    // If URL parsing fails, use the original URL
    logger.debug(`[fnRestAdvanced] URL parsing failed, using original URL: ${e.message}`);
  }

  // Outbound host allow/deny check (REST_ALLOWED_HOSTS / REST_DENIED_HOSTS).
  // No-op when neither env var is set.
  await assertUrlAllowed(url);

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })
  var axiosConfig = {
    headers: {},
    httpsAgent:httpsAgent,
    // REST_TIMEOUT_SECONDS (read on each call) : an endpoint that never answers used
    // to keep the request, and the form field waiting for it, hanging forever
    timeout: restTimeoutMs()
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
        // base64(credential_name) - for Basic auth
        if ((m = headers[key].match(/base64\(([^)]+)\)/i))) {
          // logger.debug(`[fnRestAdvanced] base64 encoding for header ${key} with credential ${m[1]}`);
          const cred = await fnCredentials(m[1]);
          if (cred && cred.user && cred.password) {
            // RFC 7617: UTF-8 encode username:password before base64 encoding
            headers[key] = headers[key].replace(/base64\(([^)]+)\)/i,Buffer.from(cred.user + ":" + cred.password, 'utf8').toString("base64"))
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

  let result
  let data=null
  try{
    if(action=="get"){
      data = await axios.get(url,axiosConfig);
    }else if(action=="post"){
      data = await axios.post(url,body,axiosConfig);
    }else if(action=="delete"){
      // axios.delete takes (url, config) : the headers live in the config and an
      // optional body goes in config.data (a DELETE has no body argument)
      if(body!=null && body!==""){
        axiosConfig.data=body
      }
      data = await axios.delete(url,axiosConfig);
    }else if(action=="put"){
      data = await axios.put(url,body,axiosConfig);
    }
    if(raw) return {data:data.data,response_headers:data.headers} // return raw data
    result=data.data
    if(jqe){
      result=await runJq(jqe, result)
    }
    if(sort)result=fnSort(result,sort)
  }catch(e){
    logger.error("Error in fnRestAdvanced: ",e)
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
    // a credential that does not exist used to crash with a TypeError on .password
    if(!token || token.password == null){
      throw new Error(`[fnRestJwtSecure] Credential '${tokenname}' not found or has no password`)
    }
    headers.Authorization=tokenPrefix + " " + token.password
  }
  return await fnRestAdvanced(action,url,body,headers,jqe,sort,hasBigInt)
}
// how long fnSsh waits for the remote command (the same default as Cmd.executeSilentCommand),
// and how long a stopped ssh gets to end before it is killed
const SSH_TIMEOUT_SECONDS = 60
const SSH_KILL_GRACE_MS = 5000

/**
 * Runs a command on a remote host over ssh, and gives its output lines.
 *
 * Args:
 *   user (string): the remote user.
 *   host (string): the remote host.
 *   cmd (string): the command, as the remote host's shell reads it.
 *   jqe (string): a jq expression applied to the output lines (none : the lines).
 *   timeoutSeconds (number): ssh is stopped after this long.
 *
 * Returns:
 *   Promise<string[]|any>: the output lines (stdout and stderr) and a last `exit(<code>)` line ;
 *     what jqe made of them when one is given.
 *
 * Raises:
 *   Error: ssh could not start, or ran out of time.
 */
const fnSsh = async function(user,host,cmd,jqe=null,timeoutSeconds=SSH_TIMEOUT_SECONDS){
  // a form's value : anything but a positive number is the default
  timeoutSeconds = Number(timeoutSeconds) > 0 ? Number(timeoutSeconds) : SSH_TIMEOUT_SECONDS

  var result= await new Promise((resolve,reject)=>{
    // Form-controlled values : ssh is run without a shell, so none of them can become a second
    // command here, and the destination comes after `--`, so a user or a host starting with '-'
    // (-oProxyCommand=...) is never read as an option. The command runs on the remote host, as
    // that host's shell reads it : that is what fnSsh is for.
    const destination = `${user}@${host}`
    logger.debug(`invoking ssh: ssh -- ${shellQuote(destination)} ${shellQuote(cmd)}`)
    // without AnsibleForms' own variables, as a playbook : ssh reads its own configuration
    var child = spawn("ssh", ["--", destination, String(cmd ?? "")], { env: playbookEnv(), stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    var output=[]
    var timedOut=false
    var killTimer=null
    // out of time : asked to stop, then killed when it does not
    var timeout=setTimeout(()=>{
      timedOut=true
      child.kill("SIGTERM")
      killTimer=setTimeout(()=>child.kill("SIGKILL"),SSH_KILL_GRACE_MS)
    },timeoutSeconds*1000)
    const stopTimers=()=>{
      clearTimeout(timeout)
      clearTimeout(killTimer)
    }

    // add output eventlistener to the process to save output
    child.stdout.on('data',function(data){
      data.split(/\r?\n/).forEach(element => {
        output.push(element)
      });
    })
    // add error eventlistener to the process to save output
    child.stderr.on('data',function(data){
      data.split(/\r?\n/).forEach(element => {
        output.push(element)
      });
    })
    // 'close', not 'exit' : 'exit' can fire before the last output is read, which was then lost
    child.on('close',function(code,signal){
      stopTimers()
      if(timedOut){
        reject(new Error(`ssh to ${destination} timed out after ${timeoutSeconds} seconds`))
        return
      }
      output.push(`exit(${code ?? signal})`)
      resolve(output)
    })
    // it could not start (ssh is not installed)
    child.on('error',function(data){
      stopTimers()
      logger.error(inspect(data))
      reject(new Error(`ssh to ${destination} failed: ${Helpers.getError(data)}`))
    })
  })
  if(jqe){
    result=await runJq(jqe, result)
  }
  return result

}
/**
 * List the contents of a directory (optionally recursively), with optional regex filtering.
 * @param {string} dirPath - The path to the directory to list.
 * @param {object} options - Options: { regex, recursive, metadata }
 * @returns {Promise<string[]|object[]>} - Array of file/folder names (if metadata=false) or objects with metadata (if metadata=true)
 */
export async function fnLs(dirPath, options = {}) {
  const results = [];
  let regex = null;
  if (options.regex) {
    regex = options.regex instanceof RegExp ? options.regex : new RegExp(options.regex);
  }
  const includeMetadata = options.metadata === true;
  
  async function walk(currentPath, relPath = "") {
    const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const isDirectory = entry.isDirectory();
      const entryName = entry.name + (isDirectory ? "/" : "");
      const fullRelPath = relPath ? path.posix.join(relPath, entryName) : entryName;
      const fullAbsPath = path.join(currentPath, entry.name);
      
      if (!regex || regex.test(fullRelPath)) {
        if (includeMetadata) {
          // Get file stats for metadata
          const stats = await fsPromises.stat(fullAbsPath);
          results.push({
            path: fullRelPath,
            name: entry.name,
            type: isDirectory ? 'directory' : 'file',
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            mode: stats.mode,
            isDirectory: isDirectory,
            isFile: stats.isFile(),
            isSymbolicLink: stats.isSymbolicLink()
          });
        } else {
          results.push(fullRelPath);
        }
      }
      
      if (options.recursive && isDirectory) {
        await walk(fullAbsPath, relPath ? path.posix.join(relPath, entry.name) : entry.name);
      }
    }
  }
  await walk(dirPath, "");
  return results;
}


/**
 * Fetches HTML content from a URL and extracts data using regex groups
 * @param {string} url - The URL to fetch HTML from
 * @param {string} regexPattern - The regex pattern with capture groups
 * @param {string} regexFlags - Optional regex flags (e.g., 'gi', 'i', 'g')
 * @returns {Promise<Array>} - Array of objects containing all group matches
 */
const fnParseHtmlWithRegex = async function(url, regexPattern, regexFlags = 'g', credential = null) {
  logger.debug(`[fnParseHtmlWithRegex] Fetching HTML from: ${url}`);
  logger.debug(`[fnParseHtmlWithRegex] Using regex pattern: ${regexPattern}`);
  
  try {
    // Dynamically import axios
    const { default: axios } = await import('axios');
    
    // Setup request headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    // Add Basic Authentication if credential provided
    if (credential) {
      const creds = await fnCredentials(credential);
      if (creds && creds.user && creds.password) {
        // RFC 7617: UTF-8 encode username:password before base64 encoding
        // Handles special chars (:, @) and UTF-8 characters (é, ñ, 中文, etc.)
        headers.Authorization = "Basic " + Buffer.from(creds.user + ':' + creds.password, 'utf8').toString('base64');
        logger.debug(`[fnParseHtmlWithRegex] Using basic authentication with credential: ${credential}`);
      }
    }
    
    // Fetch HTML content
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: headers
    });
    
    logger.debug(`[fnParseHtmlWithRegex] Successfully fetched ${response.data.length} characters`);
    
    // Create regex object
    const regex = new RegExp(regexPattern, regexFlags);
    const matches = [];
    let match;
    
    // Extract all matches with groups
    while ((match = regex.exec(response.data)) !== null) {
      const matchResult = {
        fullMatch: match[0],
        groups: [],
        namedGroups: match.groups || {}
      };
      
      // Add numbered groups (excluding index 0 which is the full match)
      for (let i = 1; i < match.length; i++) {
        matchResult.groups.push(match[i]);
      }
      
      matches.push(matchResult);
      
      // Prevent infinite loops on global regex without 'g' flag
      if (!regexFlags.includes('g')) break;
    }
    
    logger.debug(`[fnParseHtmlWithRegex] Found ${matches.length} matches`);
    return matches;
    
  } catch (error) {
    logger.error(`[fnParseHtmlWithRegex] Error: ${error.message}`);
    throw new Error(`Failed to fetch HTML or parse regex: ${error.message}`, { cause: error });
  }
};

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
  fnSsh,
  fnLs,
  fnParseHtmlWithRegex  
};
