const winston = require('winston');
require('winston-daily-rotate-file');
require('winston-syslog').Syslog;
const loggerConfig = require('../../config/log.config');
const color = {
'info': process.env.LOG_COLOR_INFO || "\x1b[32m",
'error': process.env.LOG_COLOR_ERROR || "\x1b[31m",
'warn': process.env.LOG_COLOR_WARN || "\x1b[33m",
'notice': process.env.LOG_COLOR_NOTICE || "\x1b[37m",
'debug' : process.env.LOG_COLOR_DEBUG || "\x1b[36m"
};

const formatColor = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${color[info.level] || ''}${info.level}: ${info.message}\x1b[0m`,
  ),
)
const formatNoColor = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

const transportConsole = new winston.transports.Console({
  stderrLevels: ["error"],
  level:loggerConfig.consolelevel,
  format:formatColor
});

const transportDailyRotateFileErrors = new winston.transports.DailyRotateFile({
  filename: loggerConfig.path + "/ansibleforms.errors.%DATE%.log",
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  zippedArchive: true,
  level: 'error',
  format:formatNoColor
});

const transportDailyRotateFile = new winston.transports.DailyRotateFile({
  level: loggerConfig.level,
  filename: loggerConfig.path + "/ansibleforms.%DATE%.log",
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxFiles: '30d',    
  format:formatColor
});

var transports = [
  transportConsole,
  transportDailyRotateFileErrors,
  transportDailyRotateFile,
]

transportDailyRotateFile.on('error', error => {
  console.error('Error in transportDailyRotateFile:', error);
});

transportDailyRotateFileErrors.on('error', error => {
  console.error('Error in transportDailyRotateFileErrors:', error);
});


if(loggerConfig.sysloghost){
  transports.push(
    new winston.transports.Syslog({
      host: loggerConfig.sysloghost,
      port: loggerConfig.syslogport,
      protocol: loggerConfig.syslogprotcol,
      path: loggerConfig.syslogpath,
      localhost: loggerConfig.sysloglocalhost,
      type: loggerConfig.syslogtype,
      app_name: loggerConfig.syslogappname,
      format: formatNoColor,
      level: loggerConfig.sysloglevel
    })
  )
}

const Logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports,
})

module.exports = Logger
