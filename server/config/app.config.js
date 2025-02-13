const logger=require("../src/lib/logger");
const path=require("path")
var app_config = {
  port: process.env.PORT || 8000,
  baseUrl: process.env.BASE_URL || "/",
  nodeEnvironment: process.env.NODE_ENV || "production",
  showDesigner: (process.env.SHOW_DESIGNER ?? 1)==1,
  allowSchemaCreation: (process.env.ALLOW_SCHEMA_CREATION ?? 1)==1,
  formsPath: process.env.FORMS_PATH || path.resolve(__dirname + "/../persistent/forms.yaml"),
  useYtt: (process.env.USE_YTT ?? 0)==1,
  yttDangerousAllowAllSymlinkDestinations: (process.env.YTT_DANGEROUS_ALLOW_ALL_SYMLINK_DESTINATIONS ?? 0)==1,
  yttAllowSymlinkDestinations: process.env.YTT_ALLOW_SYMLINK_DESTINATIONS || "",
  yttLibData: {},
  yttVarsPrefix: process.env.YTT_VARS_PREFIX || "",
  lockPath: process.env.LOCK_PATH || path.resolve(__dirname + "/../persistent/ansibleForms.lock"),
  helpPath: path.resolve(__dirname + "/../help.yaml"),
  encryptionSecret: ((process.env.ENCRYPTION_SECRET + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0,32)) || "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3",
  homePath: process.env.HOME_PATH || require('os').homedir(),
  uploadPath: process.env.UPLOAD_PATH || path.resolve(__dirname + "/../persistent/uploads"),
  repoPath: process.env.REPO_PATH || path.resolve(__dirname + "/../persistent/repositories"),
  formsBackupPath: process.env.FORMS_BACKUP_PATH || path.resolve(__dirname + "/../persistent/forms_backups"),
  oldBackupDays: process.env.OLD_BACKUP_DAYS || 60,
  filterJobOutputRegex: process.env.REGEX_FILTER_JOB_OUTPUT || "\\[low\\]",
  enableBypass: (process.env.ENABLE_BYPASS ?? 0)==1,
  enableDbQueryLogging: (process.env.ENABLE_DB_QUERY_LOGGING ?? 0)==1,
  enableFormsYamlInDatabase: (process.env.ENABLE_FORMS_YAML_IN_DATABASE ?? 0)==1,
  processMaxBuffer: process.env.PROCESS_MAX_BUFFER || (1024 * 1024),
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "AnsibleForms!123"
};

// process dynamic YTT_LIB_DATA_ environment variables
Object.entries(process.env).filter( ([key, value]) => key.startsWith('YTT_LIB_DATA_')).forEach( ([key, value]) => {
  const libName = key.replace('YTT_LIB_DATA_', '').toLowerCase();
  app_config.yttLibData[libName] = value;
});

module.exports = app_config;
