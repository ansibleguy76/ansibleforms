const logger=require("../src/lib/logger");
const path=require("path")
var app_config = {
  port: process.env.PORT || 8000,
  nodeEnvironment: process.env.NODE_ENV || "production",
  showDesigner: process.env.SHOW_DESIGNER ?? true,
  formsPath: process.env.FORMS_PATH || path.resolve(__dirname + "/../persistent/forms.yaml"),
  lockPath: process.env.LOCK_PATH || path.resolve(__dirname + "/../persistent/ansibleForms.lock"),
  helpPath: path.resolve(__dirname + "/../schema/help.yaml"),
  encryptionSecret: ((process.env.ENCRYPTION_SECRET + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0,32)) || "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3",
  homePath: process.env.HOME_PATH || require('os').homedir(),
  repoPath: process.env.REPO_PATH || path.resolve(__dirname + "/../persistent/repositories")
};
module.exports = app_config;
