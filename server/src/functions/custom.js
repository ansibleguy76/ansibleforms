import logger from "../lib/logger.js";
import dns from "dns";

// Add you custom functions here.  You can add the logger optionally
// logger supports .error .warn .info .debug .silly
// the functions do not need to start with fn, but we all like consistancy

const fnSum = function(a,b) {
  logger.debug("[fnSum] sum is happening")
  return a+b
};
const fnMultiply = function(a,b) {
  logger.debug("[fnMultiply] multiply is happening")
  return a*b
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

export default {
  fnSum,
  fnMultiply,
  fnDnsResolve
};