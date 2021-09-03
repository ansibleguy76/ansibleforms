'use strict';

require('./../functions/default.js')
const logger=require("../lib/logger");
//expression object create - not used, but you could create an instance with it
var Expression=function(){

};

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
