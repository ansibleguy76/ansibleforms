const logger=require("../lib/logger");

// Add you custom functions here.  You can add the logger optionally
// logger supports .error .warn .info .debug .silly
// the functions do not need to start with fn, but we all like consistancy

exports.fnSum = function(a,b) {
  logger.debug("[fnSum] sum is happening")
  return a+b
};
exports.fnMultiply = function(a,b) {
  logger.debug("[fnMultiply] multiply is happening")
  return a*b
};
exports.fnDnsResolve = async function(hostname,type) {
  logger.debug("[fnDnsResolve] dns resolve is happening")
  const dns=require("dns");
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