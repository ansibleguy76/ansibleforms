const logger=require("../src/lib/logger");
const path=require("path")
var app_config = {
  port: process.env.PORT || 8000,
  baseUrl: process.env.BASE_URL || "/",
  nodeEnvironment: process.env.NODE_ENV || "production",
  showDesigner: process.env.SHOW_DESIGNER ?? true,
  formsPath: process.env.FORMS_PATH || path.resolve(__dirname + "/../persistent/forms.yaml"),
  lockPath: process.env.LOCK_PATH || path.resolve(__dirname + "/../persistent/ansibleForms.lock"),
  helpPath: path.resolve(__dirname + "/../help.yaml"),
  encryptionSecret: ((process.env.ENCRYPTION_SECRET + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0,32)) || "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3",
  homePath: process.env.HOME_PATH || require('os').homedir(),
  uploadPath: process.env.UPLOAD_PATH || path.resolve(__dirname + "/../persistent/uploads"),
  repoPath: process.env.REPO_PATH || path.resolve(__dirname + "/../persistent/repositories"),
  formsBackupPath: process.env.FORMS_BACKUP_PATH || path.resolve(__dirname + "/../persistent/forms_backups"),
  oldBackupDays: process.env.OLD_BACKUP_DAYS || 60,
  filterJobOutputRegex: process.env.REGEX_FILTER_JOB_OUTPUT || "\\[low\\]"
};
module.exports = app_config;
