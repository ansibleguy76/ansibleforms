const fs = require("fs")
const path =require("path")
var log_config = {
  level: process.env.LOG_LEVEL || "info",
  path: process.env.LOG_PATH || path.resolve(__dirname + '/../persistent/logs'),
  consolelevel: process.env.LOG_CONSOLE_LEVEL || "info"
};
if ( !fs.existsSync( log_config.path ) ) {
  try{
    // Create the directory if it does not exist
    fs.mkdirSync( log_config.path );
  }catch(err){
    throw "Failed to create the path for the log files"
  }

}
module.exports = log_config
