'use strict';

const fn=require('./../functions/default.js')
const fnc=require('./../functions/custom.js')
// use as fn.xxxxx (where xxxxx is you own function name)


const logger=require("../lib/logger");
//expression object create - not used, but you could create an instance with it
var Expression=function(){

};

function sanitizeExpression(expr){
  var sanitized=expr
  // first we check if the expression has errors
  if(sanitized.match(/\r|\n/)){
    logger.error("Abuse attempt of eval function, attempt to have multilines")
    // return "'ACCESS DENIED, no multiline expressions allowed'"
    return undefined
  }
  // then we remove all harmless strings
  sanitized = sanitized.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g,"")
  // we check if ";" is present, no multi commands
  if(sanitized.match(/;/)){
    logger.error("Abuse attempt of eval function, attempt to have multi expression")
    // return "'ACCESS DENIED, no multiple expressions allowed'"
    return undefined
  }
  // if contains process.env
  if(sanitized.match(/process\.env/)){
    logger.error("Abuse attempt of eval function, attempt to get environment variables")
    // return "'ACCESS DENIED, no access to environment variables (process.env)'"
    return undefined
  }
  // if contains "(" and not starting with fn.fn
  if(sanitized.match(/\(/)){
    if(!sanitized.match(/^fnc{0,1}\.+/g)){
      logger.error("Abuse attempt of eval function, using custom functions")
      // return "'ACCESS DENIED, no custom functions allowed'"
      return undefined
    }
  }
  return expr
}
async function doAsync (expr) {
  try{
    var sanitized = sanitizeExpression(expr)
    var outcome = await eval(sanitized)
    return outcome
  }catch(e){
    throw e.message
  }
}
// execute expression (cannot be a promise)
Expression.execute = function (expr,noLog) {
  if(noLog){
    logger.info('Expression: noLog is applied')
  }else{
    logger.info(`Expression: ${expr}`)
  }
  var expression = ""
  try{
    return doAsync(expr)
  }catch(err){
    throw err.message
  }
};


module.exports= Expression;
