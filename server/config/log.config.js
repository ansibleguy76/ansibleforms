const resolve = require("path").resolve
var log_config = {
  level: process.env.LOG_LEVEL || "silly",
  path: process.env.LOG_PATH || resolve("../server/persistent/logs/ansibleforms.log"),
  errorPath: process.env.LOG_ERRORPATH || resolve("../server/persistent/logs/ansibleforms.error.log"),
  consolelevel: process.env.LOG_CONSOLE_LEVEL || "silly"
};
module.exports = log_config
