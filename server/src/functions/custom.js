const logger=require("../lib/logger");

// Add you custom functions here.  You can add the logger optionally
// logger supports .error .warn .info .debug .silly
// the functions do not need to start with fn, but we all like consistancy

exports.fnSum = function(a,b) {
  logger.silly("[fnSum] sum is happening")
  return a+b
};
exports.fnMultiply = function(a,b) {
  logger.silly("[fnMultiply] multiply is happening")
  return a*b
};
