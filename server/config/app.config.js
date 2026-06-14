import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { normalizeBaseUrl } from "../src/lib/baseurl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app_config = {
  port: process.env.PORT || 8000,
  // host the app under a url subpath, for example behind a reverse proxy (issue #106)
  // BASE_URL=/ansibleforms => app is served under https://host/ansibleforms/
  // normalized to "" for root hosting, or "/subpath" (leading slash, no trailing slash)
  baseUrl: normalizeBaseUrl(process.env.BASE_URL),
  nodeEnvironment: process.env.NODE_ENV || "production",
  showDesigner: (process.env.SHOW_DESIGNER ?? 1) == 1,
  allowSchemaCreation: (process.env.ALLOW_SCHEMA_CREATION ?? 1) == 1,
  configPath: process.env.CONFIG_PATH || path.resolve(__dirname + "/../persistent/config.yaml"),
  formsFolderPath: process.env.FORMS_FOLDER_PATH || path.resolve(__dirname + "/../persistent/forms"),
  // staging area for new forms in repository mode : they live here until a
  // 'Push to repo' assigns them to a chosen repository (issue #414)
  formsStagingPath: process.env.FORMS_STAGING_PATH || path.resolve(__dirname + "/../persistent/forms_staging"),
  formsPath: process.env.FORMS_PATH || path.resolve(__dirname + "/../persistent/forms.yaml"), // DEPRECATED: use configPath + formsFolderPath instead
  nightlyBackupRetention: parseInt(process.env.NIGHTLY_BACKUP_RETENTION || "7", 10),
  useYtt: (process.env.USE_YTT ?? 0) == 1,
  yttDangerousAllowAllSymlinkDestinations: (process.env.YTT_DANGEROUS_ALLOW_ALL_SYMLINK_DESTINATIONS ?? 0) == 1,
  yttAllowSymlinkDestinations: process.env.YTT_ALLOW_SYMLINK_DESTINATIONS || "",
  yttLibData: {},
  yttVarsPrefix: process.env.YTT_VARS_PREFIX || "",
  lockPath: process.env.LOCK_PATH || path.resolve(__dirname + "/../persistent/ansibleForms.lock"),
  helpPath: existsSync(path.resolve(__dirname + "/../help.yaml"))
    ? path.resolve(__dirname + "/../help.yaml")
    : path.resolve(__dirname + "/../../docs/_data/help.yaml"),
  encryptionSecret: ((process.env.ENCRYPTION_SECRET || "undefinedvOVH6sdmpNWjRRIqCc7rdxs") + "vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3").substring(0, 32),
  homePath: process.env.HOME_PATH || os.homedir(),
  uploadPath: process.env.UPLOAD_PATH || path.resolve(__dirname + "/../persistent/uploads"),
  varsFilesPath: process.env.VARS_FILES_PATH || path.resolve(__dirname + "/../persistent/vars"),
  repoPath: process.env.REPO_PATH || path.resolve(__dirname + "/../persistent/repositories"),
  formsBackupPath: process.env.FORMS_BACKUP_PATH || path.resolve(__dirname + "/../persistent/forms_backups"),
  oldBackupDays: process.env.OLD_BACKUP_DAYS || 60,
  filterJobOutputRegex: process.env.REGEX_FILTER_JOB_OUTPUT || "\\[low\\]",
  // REINIT_ADMIN=1 forces a one-time recreation of the local `admin` user
  // (and its admins group) at startup, using ADMIN_USERNAME / ADMIN_PASSWORD.
  // Intended as a recovery hatch only — unset after use. NOT a runtime auth bypass.
  reinitAdmin: (process.env.REINIT_ADMIN ?? 0) == 1,
  // Cap on JSON / urlencoded request bodies (form designer, extravars, etc.).
  // Defaults to 50 MB; override via API_BODY_LIMIT_MB.
  apiBodyLimitMb: parseInt(process.env.API_BODY_LIMIT_MB ?? "50", 10) || 50,
  // Cap on a single uploaded file (in GB). Default 10 GB to allow upgrade
  // artifacts; override via UPLOAD_MAX_GB. Set to 0 to disable the cap.
  uploadMaxGb: parseInt(process.env.UPLOAD_MAX_GB ?? "10", 10),
  enableDbQueryLogging: (process.env.ENABLE_DB_QUERY_LOGGING ?? 0) == 1,
  // ENABLE_CONFIG_IN_DATABASE takes priority, falls back to deprecated ENABLE_FORMS_YAML_IN_DATABASE
  enableConfigInDatabase: (() => {
    if (process.env.ENABLE_CONFIG_IN_DATABASE !== undefined) {
      return (process.env.ENABLE_CONFIG_IN_DATABASE ?? 0) == 1;
    }
    // Fall back to deprecated variable
    return (process.env.ENABLE_FORMS_YAML_IN_DATABASE ?? 0) == 1;
  })(),
  // Deprecated: Use enableConfigInDatabase instead
  enableFormsYamlInDatabase: (() => {
    if (process.env.ENABLE_CONFIG_IN_DATABASE !== undefined) {
      return (process.env.ENABLE_CONFIG_IN_DATABASE ?? 0) == 1;
    }
    return (process.env.ENABLE_FORMS_YAML_IN_DATABASE ?? 0) == 1;
  })(),
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
