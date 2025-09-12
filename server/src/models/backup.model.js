
import Cmd from '../lib/cmd.js';
import dbConfig from '../../config/db.config.js';
import { promises as fs } from 'fs';
import path from 'path';
import appConfig from '../../config/app.config.js';
import Helpers from '../lib/common.js';
import yaml from 'yaml';
import Errors from '../lib/errors.js';
import logger from '../lib/logger.js';

// --- Helpers for backup details ---
async function getFileSize(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

async function getDirStats(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        fileCount++;
        totalSize += stat.size;
      }
    }
  } catch {}
  return { fileCount, totalSize };
}

// reusable directory copy helper (used by copyFormsAndFolder and restore)
async function copyDir(src, dest) {
  // if source doesn't exist or isn't a directory, do nothing
  try {
    const stat = await fs.stat(src);
    if (!stat.isDirectory()) return;
  } catch {
    return;
  }
  logger.debug(`Copying dir ${src} -> ${dest}`)
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      logger.debug(`Copying file ${srcPath} -> ${destPath}`)
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// copy file only if exists
async function copyFileIfExists(src,dest){
    var exists=true
    try {
      await fs.access(src);
    } catch {
      exists=false
      logger.warning(`File ${src} not found`)
    }   
    if(exists){   
      logger.debug(`Copying file ${src} -> ${dest}`)
      await fs.copyFile(src, dest);
    }
}

class BackupModel {
  static getBackupPaths() {
    const backupRoot = appConfig.backupPath;
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const backupFolder = path.join(backupRoot, timestamp);
    const backupFile = path.join(backupFolder, 'ansibleforms.sql');
    return { backupRoot, backupFolder, backupFile, timestamp };
  }

  static async backupFormsAndFolder(backupFolder) {
    logger.info(`Copying yaml and forms folder to ${backupFolder}`)
    const formsFile = appConfig.formsPath;
    const formsDir = path.join(path.dirname(formsFile), 'forms');
    const destFile = path.join(backupFolder, path.basename(formsFile));
    const destDir = path.join(backupFolder, 'forms');
    await copyFileIfExists(formsFile, destFile);
    await copyDir(formsDir, destDir);
  }


  static async restoreFormsAndFolder(restoreFolder) {
    logger.info(`Copying yaml and forms folder from ${this.restoreFolder}`)
    const formsFile = appConfig.formsPath;
    const formsYamlBackup = path.join(restoreFolder, path.basename(formsFile));
    const formsDir = path.join(path.dirname(formsFile), 'forms');
    const formsDirBackup = path.join(restoreFolder, 'forms');
    // restore base forms yaml if backup exists
    await copyFileIfExists(formsYamlBackup, formsFile);
    // restore forms directory if backup exists (copyDir is a no-op if src missing)
    await copyDir(formsDirBackup, formsDir);
  }


  static async doBackup(description) {
    logger.info(`Running backup '${description}'`)
    const dbName = 'AnsibleForms';
    const dbHost = dbConfig.host;
    const dbUser = dbConfig.user;
    const dbPassword = dbConfig.password;
    const dbPort = dbConfig.port;
    const { backupFolder, backupFile, timestamp } = this.getBackupPaths();
    await fs.mkdir(backupFolder, { recursive: true });
    const safePassword = dbPassword.replace(/'/g, "'\"'\"'");
    const dumpCmd = `${appConfig.mysqldumpCommand} -h ${dbHost} -u'${dbUser}' -p'${safePassword}' -P ${dbPort} ${dbName} > "${backupFile}"`;
    const cmdObj = {
      command: dumpCmd,
      directory: process.cwd(),
      description: `Database backup to ${backupFile}`,
      maskedCommand: `${appConfig.mysqldumpCommand} -h ${dbHost} -u'${dbUser}' -p'*****' -P ${dbPort} ${dbName} > "${backupFile}"`
    };
    await Cmd.executeSilentCommand(cmdObj, true);
    await this.backupFormsAndFolder(backupFolder);
    const meta = { description: description || '' };
    await fs.writeFile(path.join(backupFolder, 'meta.yaml'), yaml.stringify(meta), 'utf8');
    return { backupFolder, backupFile, timestamp, description: meta.description };
  }

  static async restore(folder, backupFirst = false) {
    logger.info(`Running restore from '${folder}'`)
    const dbName = 'AnsibleForms';
    const dbHost = dbConfig.host;
    const dbUser = dbConfig.user;
    const dbPassword = dbConfig.password;
    const dbPort = dbConfig.port;
    if (!folder || !/^\d{14}$/.test(folder)) throw new Errors.BadRequestError('Invalid or missing backup folder');
    if (backupFirst) {
      await this.doBackup(`Auto backup before restore of ${folder}`);
    }
    const restoreFolder = path.join(appConfig.backupPath, folder);
    let stat;
    try {
      stat = await fs.stat(restoreFolder);
    } catch {
      throw new Errors.NotFoundError('Backup folder not found');
    }
    if (!stat.isDirectory()) throw new Errors.NotFoundError('Backup folder not found');
    const backupFile = path.join(restoreFolder, 'ansibleforms.sql');
    const formsFile = appConfig.formsPath;
    const formsYamlBackup = path.join(restoreFolder, path.basename(formsFile));
    const formsDir = path.join(path.dirname(formsFile), 'forms');
    const formsDirBackup = path.join(restoreFolder, 'forms');
    const safePassword = dbPassword.replace(/'/g, "'\"'\"'");
    const restoreCmd = `${appConfig.mysqlCommand} -h ${dbHost} -u'${dbUser}' -p'${safePassword}' -P ${dbPort} ${dbName} < "${backupFile}"`;
    const cmdObj = {
      command: restoreCmd,
      directory: process.cwd(),
      description: `Database restore from ${backupFile}`,
      maskedCommand: `${appConfig.mysqlCommand} -h ${dbHost} -u'${dbUser}' -p'*****' -P ${dbPort} ${dbName} < "${backupFile}"`
    };
    await Cmd.executeSilentCommand(cmdObj, true);
    await this.restoreFormsAndFolder(restoreFolder);
    return { message: 'Restore completed', restoreFolder };
  }

  static async listBackups() {
    await fs.mkdir(appConfig.backupPath, { recursive: true });
    const folders = (await fs.readdir(appConfig.backupPath)).filter(f => /^\d{14}$/.test(f));
    folders.sort((a, b) => b.localeCompare(a));
    const records = await Promise.all(folders.map(async folder => {
      const backupFolder = path.join(appConfig.backupPath, folder);
      const backupFile = path.join(backupFolder, 'ansibleforms.sql');
      const formsYaml = path.join(backupFolder, path.basename(appConfig.formsPath));
      const formsDir = path.join(backupFolder, 'forms');
      let description = '';
      try {
        const metaRaw = await fs.readFile(path.join(backupFolder, 'meta.yaml'), 'utf8');
        const meta = yaml.parse(metaRaw);
        description = meta?.description || '';
      } catch {}
      const formsYamlSize = await getFileSize(formsYaml);
      const backupFileSize = await getFileSize(backupFile);
      const formsDirStats = await getDirStats(formsDir);
      return {
        folder,
        date: Helpers.dateFromBackupFolder(folder),
        description,
        backupFileExists: await fs.stat(backupFile).then(() => true).catch(() => false),
        formsYamlExists: await fs.stat(formsYaml).then(() => true).catch(() => false),
        formsDirExists: await fs.stat(formsDir).then(() => true).catch(() => false),
        formsYamlSize,
        backupFileSize,
        formsDirFileCount: formsDirStats.fileCount,
        formsDirTotalSize: formsDirStats.totalSize
      };
    }));
    return records;
  }

  static async deleteBackup(folder) {
  if (!folder || !/^\d{14}$/.test(folder)) throw new Errors.BadRequestError('Invalid or missing folder parameter');
    const backupFolder = path.join(appConfig.backupPath, folder);
    await fs.rm(backupFolder, { recursive: true, force: true });
    return { message: 'Backup deleted', folder };
  }

  static async getBackupByFolder(folder) {
  if (!folder || !/^\d{14}$/.test(folder)) throw new Errors.BadRequestError('Invalid or missing backup folder');
    const backupFolder = path.join(appConfig.backupPath, folder);
    const backupFile = path.join(backupFolder, 'ansibleforms.sql');
    const formsYaml = path.join(backupFolder, path.basename(appConfig.formsPath));
    const formsDir = path.join(backupFolder, 'forms');
    let description = '';
    let stat;
    try {
      stat = await fs.stat(backupFolder);
    } catch {
      throw new Errors.NotFoundError('Backup folder not found');
    }
    if (!stat.isDirectory()) throw new Errors.NotFoundError('Backup folder not found');
    try {
      const metaRaw = await fs.readFile(path.join(backupFolder, 'meta.yaml'), 'utf8');
      const meta = yaml.parse(metaRaw);
      description = meta?.description || '';
    } catch {}
    const formsYamlSize = await getFileSize(formsYaml);
    const backupFileSize = await getFileSize(backupFile);
    const formsDirStats = await getDirStats(formsDir);
    return {
      folder,
      date: Helpers.dateFromBackupFolder(folder),
      description,
      backupFileExists: await fs.stat(backupFile).then(() => true).catch(() => false),
      formsYamlExists: await fs.stat(formsYaml).then(() => true).catch(() => false),
      formsDirExists: await fs.stat(formsDir).then(() => true).catch(() => false),
      formsYamlSize,
      backupFileSize,
      formsDirFileCount: formsDirStats.fileCount,
      formsDirTotalSize: formsDirStats.totalSize
    };
  }
}

export default BackupModel;
