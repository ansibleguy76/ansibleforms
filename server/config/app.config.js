const logger=require("../src/lib/logger");
var app_config = {
  port: process.env.PORT || 8000,
  nodeEnvironment: process.env.NODE_ENV || "production",
  formsPath: process.env.FORMS_PATH || (__dirname + "/../persistent/forms.yaml"),
  encryptionSecret: ((process.env.ENCRYPTION_SECRET + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0,32)) || "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3",
  homeDir: process.env.HOME_DIR || "/root"
};
module.exports = app_config;
