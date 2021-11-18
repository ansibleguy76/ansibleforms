const winston = require('winston');
const loggerConfig = require('../../config/log.config');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  silly: 5
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
  silly: 'cyan'
}

winston.addColors(colors)

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

const transports = [
  new winston.transports.Console({
    stderrLevels: ["error"],
    level:loggerConfig.consolelevel || "info"
  }),
  new winston.transports.File({
    filename: loggerConfig.path + "/ansibleforms.errors.log",
    level: 'error',
  }),
  new winston.transports.File({ filename: loggerConfig.path + "/ansibleforms.log" }),
]

const Logger = winston.createLogger({
  level: loggerConfig.level || "info",
  levels,
  format,
  transports,
})

module.exports = Logger
