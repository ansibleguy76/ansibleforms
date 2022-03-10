const winston = require('winston');
require('winston-syslog').Syslog;
const loggerConfig = require('../../config/log.config');

const formatColor = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)
const formatNoColor = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

const transports = [
  new winston.transports.Console({
    stderrLevels: ["error"],
    level:loggerConfig.consolelevel || "info",
    format:formatColor
  }),
  new winston.transports.File({
    filename: loggerConfig.path + "/ansibleforms.errors.log",
    level: 'error',
    format:formatNoColor
  }),
  new winston.transports.File({
    filename: loggerConfig.path + "/ansibleforms.log",
    format:formatNoColor
  }),
  new winston.transports.Syslog({
    host: loggerConfig.sysloghost,
    port: loggerConfig.syslogport,
    protocol: loggerConfig.syslogprotcol,
    path: loggerConfig.syslogpath,
    localhost: loggerConfig.sysloglocalhost,
    type: loggerConfig.syslogtype,
    app_name: loggerConfig.syslogappname,
    format: formatNoColor
  })
]

const Logger = winston.createLogger({
  level: loggerConfig.loglevel || "info",
  levels: winston.config.syslog.levels,
  transports,
})

module.exports = Logger
