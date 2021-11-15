const resolve = require("path").resolve
const logger=require("../src/lib/logger");
var app_config = {
  port: process.env.PORT || 8443,
  nodeEnvironment: process.NODE_ENV || "development",
  formsPath: process.env.FORMS_PATH || resolve("./../server/persistent/forms.json"),
  forceDotEnv: (process.env.FORCE_DOTENV==1) || false,
  encryptionSecret: ((process.env.ENCRYPTION_SECRET + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0,32)) || "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3"
};
module.exports = app_config;
