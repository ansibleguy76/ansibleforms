'use strict';

const fn=require('./../functions/default.js')
// use as fn.xxxxx (where xxxxx is you own function name)


const logger=require("../lib/logger");
//expression object create - not used, but you could create an instance with it
var Expression=function(){

};

async function doAsync (expr) {
  return await eval(expr)
}

// execute expression (cannot be a promise)
Expression.execute = function (expr, result) {
  logger.debug(`Expression: ${expr}`)
  var expression = ""
  try{
    doAsync(expr).then(function(response){result(null,response)})
    // var r = eval(expression)
    // result(null,r)
  }catch(err){
    result(err.message,null)
  }
};

module.exports= Expression;
