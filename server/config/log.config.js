const fs = require("fs")
var log_config = {
  level: process.env.LOG_LEVEL || "info",
  path: process.env.LOG_PATH || (__dirname + '/../persistent/logs/ansibleforms.log'),
  errorPath: process.env.LOG_ERRORPATH || (__dirname + '/../persistent/logs/ansibleforms.error.log'),
  consolelevel: process.env.LOG_CONSOLE_LEVEL || "info"
};
if ( !fs.existsSync( __dirname + '/../persistent/logs' ) ) {
    // Create the directory if it does not exist
    fs.mkdirSync( __dirname + '/../persistent/logs' );
}
module.exports = log_config
