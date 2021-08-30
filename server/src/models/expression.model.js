'use strict';

require('./../functions/default.js')
const logger=require("../lib/logger");
//expression object create - not used, but you could create an instance with it
var Expression=function(){

};

function addNumbers(nr1,nr2){
  logger.debug(`adding 2 number ${nr1},${nr2}`)
  return fn.add(nr1,nr2);
}

function concatStrings(str1,str2){
  logger.debug(`concat 2 strings ${str1},${str2}`)
  return str1+str2
}

function multiplyNumbers(nr1,nr2){
  logger.debug(`multiply 2 numbers ${nr1},${nr2}`)
  return nr1*nr2
}

// execute expression (cannot be a promise)
Expression.execute = function (expr, result) {
  logger.debug(`Expression: ${expr}`)
  try{
    var r = eval(expr)
    result(null,r)
  }catch(err){
    result(err.message,null)
  }
};

module.exports= Expression;
