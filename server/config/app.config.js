import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app_config = {
  port: process.env.PORT || 8000,
  nodeEnvironment: process.env.NODE_ENV || "production",
  showDesigner: (process.env.SHOW_DESIGNER ?? 1) == 1,
  allowSchemaCreation: (process.env.ALLOW_SCHEMA_CREATION ?? 1) == 1,
  configPath: process.env.CONFIG_PATH || path.resolve(__dirname + "/../persistent/config.yaml"),
  formsFolderPath: process.env.FORMS_FOLDER_PATH || path.resolve(__dirname + "/../persistent/forms"),
  formsPath: process.env.FORMS_PATH || path.resolve(__dirname + "/../persistent/forms.yaml"), // DEPRECATED: use configPath + formsFolderPath instead
  nightlyBackupRetention: parseInt(process.env.NIGHTLY_BACKUP_RETENTION || "7", 10),
  useYtt: (process.env.USE_YTT ?? 0) == 1,
  yttDangerousAllowAllSymlinkDestinations: (process.env.YTT_DANGEROUS_ALLOW_ALL_SYMLINK_DESTINATIONS ?? 0) == 1,
  yttAllowSymlinkDestinations: process.env.YTT_ALLOW_SYMLINK_DESTINATIONS || "",
  yttLibData: {},
  yttVarsPrefix: process.env.YTT_VARS_PREFIX || "",
  lockPath: process.env.LOCK_PATH || path.resolve(__dirname + "/../persistent/ansibleForms.lock"),
  helpPath: path.resolve(__dirname + "/../help.yaml"),
  encryptionSecret: ((process.env.ENCRYPTION_SECRET || "undefinedvOVH6sdmpNWjRRIqCc7rdxs") + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0, 32),
  homePath: process.env.HOME_PATH || os.homedir(),
  uploadPath: process.env.UPLOAD_PATH || path.resolve(__dirname + "/../persistent/uploads"),
  varsFilesPath: process.env.VARS_FILES_PATH || path.resolve(__dirname + "/../persistent/vars"),
  repoPath: process.env.REPO_PATH || path.resolve(__dirname + "/../persistent/repositories"),
  formsBackupPath: process.env.FORMS_BACKUP_PATH || path.resolve(__dirname + "/../persistent/forms_backups"),
  oldBackupDays: process.env.OLD_BACKUP_DAYS || 60,
  filterJobOutputRegex: process.env.REGEX_FILTER_JOB_OUTPUT || "\\[low\\]",
  enableBypass: (process.env.ENABLE_BYPASS ?? 0) == 1,
  enableDbQueryLogging: (process.env.ENABLE_DB_QUERY_LOGGING ?? 0) == 1,
  enableFormsYamlInDatabase: (process.env.ENABLE_FORMS_YAML_IN_DATABASE ?? 0) == 1,
  processMaxBuffer: process.env.PROCESS_MAX_BUFFER || 1024 * 1024,
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "AnsibleForms!123",
  awxApiPrefix: process.env.AWX_API_PREFIX || "/api/v2",
  backupPath: process.env.BACKUP_PATH || path.resolve(__dirname + "/../persistent/backups"),
  mysqldumpCommand: process.env.MYSQLDUMP_COMMAND || "mariadb-dump --ssl-verify-server-cert=OFF",
  mysqlCommand: process.env.MYSQL_COMMAND || "mariadb --ssl-verify-server-cert=OFF",
  maskExtravarsRegex: process.env.MASK_EXTRAVARS_REGEX || "password|secret|token",
  gitCloneCommand: process.env.GIT_CLONE_COMMAND || "git clone",
  gitPullCommand: process.env.GIT_PULL_COMMAND || "git pull"
};

// process dynamic YTT_LIB_DATA_ environment variables
Object.entries(process.env)
  .filter(([key, value]) => key.startsWith("YTT_LIB_DATA_"))
  .forEach(([key, value]) => {
    const libName = key.replace("YTT_LIB_DATA_", "").toLowerCase();
    app_config.yttLibData[libName] = value;
  });

export default app_config;
