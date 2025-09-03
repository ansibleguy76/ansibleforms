
import Cmd from '../lib/cmd.js';
import dbConfig from '../../config/db.config.js';
import { promises as fs } from 'fs';
import path from 'path';
import appConfig from '../../config/app.config.js';
import Helpers from '../lib/common.js';
import yaml from 'yaml';
import Errors from '../lib/errors.js';

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

class BackupModel {
  static getBackupPaths() {
    const backupRoot = appConfig.backupPath;
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const backupFolder = path.join(backupRoot, timestamp);
    const backupFile = path.join(backupFolder, 'ansibleforms.sql');
    return { backupRoot, backupFolder, backupFile, timestamp };
  }

  static async copyFormsAndFolder(backupFolder) {
    const formsFile = appConfig.formsPath;
    const formsDir = path.join(path.dirname(formsFile), 'forms');
    const destFile = path.join(backupFolder, path.basename(formsFile));
    const destDir = path.join(backupFolder, 'forms');
    await fs.copyFile(formsFile, destFile);
    async function copyDir(src, dest) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    }
    await copyDir(formsDir, destDir);
  }

  static async doBackup(description) {
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
    await this.copyFormsAndFolder(backupFolder);
    const meta = { description: description || '' };
    await fs.writeFile(path.join(backupFolder, 'meta.yaml'), yaml.stringify(meta), 'utf8');
    return { backupFolder, backupFile, timestamp, description: meta.description };
  }

  static async restore(folder, backupFirst = false) {
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
    await fs.copyFile(formsYamlBackup, formsFile);
    async function copyDir(src, dest) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    }
    await copyDir(formsDirBackup, formsDir);
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
