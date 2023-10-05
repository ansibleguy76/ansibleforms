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
  var message=""
  // first we check if the expression has errors
  if(sanitized.match(/\r|\n/)){
    message="Abuse attempt of eval function, attempt to have multilines"
    logger.error(message)
    // return "'ACCESS DENIED, no multiline expressions allowed'"
    throw Error(message)
  }
  // then we remove all harmless strings
  sanitized = sanitized.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g,"")
  // we check if ";" is present, no multi commands
  if(sanitized.match(/;/)){
    message="Abuse attempt of eval function, attempt to have multi expression, try runLocal"
    logger.error(message)
    // return "'ACCESS DENIED, no multiple expressions allowed'"
    throw Error(message)
  }
  // if contains process.env
  if(sanitized.match(/process\.env/)){
    message="Abuse attempt of eval function, attempt to get environment variables"
    logger.error(message)
    // return "'ACCESS DENIED, no access to environment variables (process.env)'"
    throw Error(message)
  }
  // if contains "(" and not starting with fn.fn
  if(sanitized.match(/\(/)){
    if(!sanitized.match(/^fnc{0,1}\.+/g)){
      message="Abuse attempt of eval function, using custom functions, try runLocal"
      logger.error(message)
      // return "'ACCESS DENIED, no custom functions allowed'"
      throw Error(message)
    }
  }
  return expr
}
async function doAsync (expr) {
    var sanitized = sanitizeExpression(expr)
    var outcome = await eval(sanitized)
    return outcome
}
// execute expression (cannot be a promise)
Expression.execute = function (expr,noLog) {
  if(noLog){
    logger.info('Expression: noLog is applied')
  }else{
    logger.info(`Expression: ${expr}`)
  }
  return doAsync(expr)
};


module.exports= Expression;
