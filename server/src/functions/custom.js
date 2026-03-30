import logger from "../lib/logger.js";

// Add you custom functions here.  You can add the logger optionally
// logger supports .error .warn .info .notice .debug
// the functions do not need to start with fn, but we all like consistancy

const fnSum = function(a,b) {
  logger.debug("[fnSum] sum is happening")
  return a+b
};
const fnMultiply = function(a,b) {
  logger.debug("[fnMultiply] multiply is happening")
  return a*b
};

export default {
  fnSum,
  fnMultiply
};