const fs = require("fs")
const path =require("path")

var log_config = {
  level: process.env.LOG_LEVEL || "notice",
  path: process.env.LOG_PATH || path.resolve(__dirname + '/../persistent/logs'),
  consolelevel: process.env.LOG_CONSOLE_LEVEL || "notice",
  sysloglevel: process.env.LOG_SYSLOG_LEVEL || "debug",
  sysloghost: process.env.LOG_SYSLOG_HOST || "localhost",
  syslogport: process.env.LOG_SYSLOG_PORT || 514,
  syslogprotocol: process.env.LOG_SYSLOG_PROTOCOL || "udp4",
  syslogpath: process.env.LOG_SYSLOG_PATH || "/dev/log",
  sysloglocalhost: process.env.LOG_SYSLOG_SOURCE || "localhost",
  syslogtype: process.env.LOG_SYSLOG_TYPE || "BSD",
  syslogappname: process.env.LOG_SYSLOG_APPNAME || "AnsibleForms"
};
if ( !fs.existsSync( log_config.path ) ) {
  try{
    // Create the directory if it does not exist
    fs.mkdirSync( log_config.path );
  }catch(err){
    throw new Error("Failed to create the path for the log files")
  }

}
module.exports = log_config
