const fs = require("fs")
var log_config = {
  level: process.env.LOG_LEVEL || "info",
  path: process.env.LOG_PATH || (__dirname + '/../persistent/logs'),
  consolelevel: process.env.LOG_CONSOLE_LEVEL || "info"
};
if ( !fs.existsSync( log_config.path ) ) {
    // Create the directory if it does not exist
    fs.mkdirSync( log_config.path );
}
module.exports = log_config
