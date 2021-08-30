var log_config = {
  level: process.env.LOG_LEVEL,
  path: process.env.LOG_PATH,
  errorPath: process.env.LOG_ERRORPATH,
  consolelevel: process.env.LOG_CONSOLE_LEVEL
};
module.exports = log_config
