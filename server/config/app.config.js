const resolve = require("path").resolve
const logger=require("../src/lib/logger");
var app_config = {
  port: process.env.PORT || 8443,
  nodeEnvironment: process.NODE_ENV || "development",
  formsPath: process.env.FORMS_PATH || resolve("./../server/persistent/forms.json"),
  forceDotEnv: (process.env.FORCE_DOTENV==1) || false
};
module.exports = app_config;
