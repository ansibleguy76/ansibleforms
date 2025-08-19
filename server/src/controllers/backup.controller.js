import Cmd from '../lib/cmd.js';
import dbConfig from '../../config/db.config.js';
import { promises as fs } from 'fs';
import path from 'path';
import RestResult from '../models/restResult.model.v2.js';
import appConfig from '../../config/app.config.js';
import logConfig from '../../config/log.config.js';
import { DateTime } from 'luxon';
import Helpers from '../lib/common.js';
import yaml from 'yaml';

// Utility to get backup folder and file paths
function getBackupPaths() {
  const backupRoot = appConfig.backupPath;
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const backupFolder = path.join(backupRoot, timestamp);
  const backupFile = path.join(backupFolder, 'ansibleforms.sql');
  return { backupRoot, backupFolder, backupFile, timestamp };
}

// Utility to copy forms.yaml and forms directory
async function copyFormsAndFolder(backupFolder) {
  const formsFile = appConfig.formsPath;
  const formsDir = path.join(path.dirname(formsFile), 'forms');
  const destFile = path.join(backupFolder, path.basename(formsFile));
  const destDir = path.join(backupFolder, 'forms');
  await fs.copyFile(formsFile, destFile);
  // Recursively copy forms directory
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

async function doBackup(description) {
  const dbName = 'AnsibleForms';
  const dbHost = dbConfig.host;
  const dbUser = dbConfig.user;
  const dbPassword = dbConfig.password;
  const dbPort = dbConfig.port;
  const { backupFolder, backupFile, timestamp } = getBackupPaths();
  await fs.mkdir(backupFolder, { recursive: true });
  const safePassword = dbPassword.replace(/'/g, "'\"'\"'");
  const dumpCmd = `mariadb-dump -h ${dbHost} -u'${dbUser}' -p'${safePassword}' -P ${dbPort} ${dbName} > "${backupFile}"`;
  const cmdObj = {
    command: dumpCmd,
    directory: process.cwd(),
    description: `Database backup to ${backupFile}`,
    maskedCommand: `mariadb-dump -h ${dbHost} -u'${dbUser}' -p'*****' -P ${dbPort} ${dbName} > "${backupFile}"`
  };
  try {
    await Cmd.executeSilentCommand(cmdObj, true);
    await copyFormsAndFolder(backupFolder);
    // Write meta.yaml
    const meta = { description: description || '' };
    await fs.writeFile(path.join(backupFolder, 'meta.yaml'), yaml.stringify(meta), 'utf8');
    return { backupFolder, backupFile, timestamp, description: meta.description };
  } catch (error) {
    throw error;
  }
}

const databaseController = {
  async backup(req, res) {
    try {
      const desc = req.body?.description;
      const { backupFolder, backupFile, timestamp, description } = await doBackup(desc);
      res.json(RestResult.single({
        message: 'Backup created',
        backupFolder,
        backupFile,
        timestamp,
        description
      }));
    } catch (error) {
      res.status(500).json(RestResult.error('Backup failed', error.stderr || error.message));
    }
  },
  async restore(req, res) {
    const dbName = 'AnsibleForms';
    const dbHost = dbConfig.host;
    const dbUser = dbConfig.user;
    const dbPassword = dbConfig.password;
    const dbPort = dbConfig.port;

    // Require folder only from params (right format) yyyymmddhhmmss
    const folder = req.params.folder;
    if (!folder || !/^\d{14}$/.test(folder)) {
      return res.status(404).json(RestResult.error('Invalid or missing backup folder'));
    }
    // If backupFirst query flag is set, perform a backup before restore
    if (req.query.backupFirst === 'true' || req.query.backupFirst === true) {
      try {
        const backupDesc = `Auto backup before restore of ${folder}`;
        await doBackup(backupDesc);
      } catch (err) {
        return res.status(500).json(RestResult.error('Backup before restore failed', err?.message || err));
      }
    }
    const restoreFolder = path.join(appConfig.backupPath, folder);
    // Check if folder exists
    try {
      const stat = await fs.stat(restoreFolder);
      if (!stat.isDirectory()) throw new Error('Not a directory');
    } catch {
      return res.status(404).json(RestResult.error('Backup folder not found'));
    }
    const backupFile = path.join(restoreFolder, 'ansibleforms.sql');
    const formsFile = appConfig.formsPath;
    const formsYamlBackup = path.join(restoreFolder, path.basename(formsFile));
    const formsDir = path.join(path.dirname(formsFile), 'forms');
    const formsDirBackup = path.join(restoreFolder, 'forms');

    // Restore DB
    const safePassword = dbPassword.replace(/'/g, "'\"'\"'");
    const restoreCmd = `mariadb -h ${dbHost} -u'${dbUser}' -p'${safePassword}' -P ${dbPort} ${dbName} < "${backupFile}"`;
    const cmdObj = {
      command: restoreCmd,
      directory: process.cwd(),
      description: `Database restore from ${backupFile}`,
      maskedCommand: `mariadb -h ${dbHost} -u'${dbUser}' -p'*****' -P ${dbPort} ${dbName} < "${backupFile}"`
    };
    try {
      await Cmd.executeSilentCommand(cmdObj, true);
      // Restore forms.yaml
      await fs.copyFile(formsYamlBackup, formsFile);
      // Restore forms directory
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
      res.json(RestResult.single({
        message: 'Restore completed',
        restoreFolder
      }));
    } catch (error) {
      res.status(500).json(RestResult.error('Restore failed', error.stderr || error.message));
    }
  },
  async listBackups(req, res) {
    try {
      const folders = (await fs.readdir(appConfig.backupPath)).filter(f => /^\d{14}$/.test(f));
      folders.sort((a, b) => b.localeCompare(a));
      const records = await Promise.all(folders.map(async folder => {
        const backupFolder = path.join(appConfig.backupPath, folder);
        const backupFile = path.join(backupFolder, 'ansibleforms.sql');
        const formsYaml = path.join(backupFolder, path.basename(appConfig.formsPath));
        const formsDir = path.join(backupFolder, 'forms');
        // Read meta.yaml if exists
        let description = '';
        try {
          const metaRaw = await fs.readFile(path.join(backupFolder, 'meta.yaml'), 'utf8');
          const meta = yaml.parse(metaRaw);
          description = meta?.description || '';
        } catch {}
        return {
          folder,
          date: Helpers.dateFromBackupFolder(folder),
          description,
          backupFileExists: await fs.stat(backupFile).then(() => true).catch(() => false),
          formsYamlExists: await fs.stat(formsYaml).then(() => true).catch(() => false),
          formsDirExists: await fs.stat(formsDir).then(() => true).catch(() => false)
        };
      }));
      res.json(RestResult.list(records));
    } catch (error) {
      res.status(500).json(RestResult.error('Failed to list backups', error.message));
    }
  },
  async reset(req, res) {
    // TODO: Implement reset logic
  res.json(RestResult.single({ message: 'Database reset (stub)' }));
  },
  async deleteBackup(req, res) {
    const folder = req.params.folder;
    if (!folder || !/^\d{14}$/.test(folder)) {
      return res.status(400).json(RestResult.error('Invalid or missing folder parameter'));
    }
    const backupFolder = path.join(appConfig.backupPath, folder);
    try {
      // Recursively remove the backup folder
      await fs.rm(backupFolder, { recursive: true, force: true });
      res.json(RestResult.single({ message: 'Backup deleted', folder }));
    } catch (error) {
      res.status(500).json(RestResult.error('Failed to delete backup', error.message));
    }
  },
  async getBackupByFolder(req, res) {
    const folder = req.params.folder;
    if (!folder || !/^\d{14}$/.test(folder)) {
      return res.status(404).json(RestResult.error('Invalid or missing backup folder'));
    }
    const backupFolder = path.join(appConfig.backupPath, folder);
    const backupFile = path.join(backupFolder, 'ansibleforms.sql');
    const formsYaml = path.join(backupFolder, path.basename(appConfig.formsPath));
    const formsDir = path.join(backupFolder, 'forms');
    // Read meta.yaml if exists
    let description = '';
    try {
      const stat = await fs.stat(backupFolder);
      if (!stat.isDirectory()) throw new Error('Not a directory');
      try {
        const metaRaw = await fs.readFile(path.join(backupFolder, 'meta.yaml'), 'utf8');
        const meta = yaml.parse(metaRaw);
        description = meta?.description || '';
      } catch {}
      const record = {
        folder,
        date: Helpers.dateFromBackupFolder(folder),
        description,
        backupFileExists: await fs.stat(backupFile).then(() => true).catch(() => false),
        formsYamlExists: await fs.stat(formsYaml).then(() => true).catch(() => false),
        formsDirExists: await fs.stat(formsDir).then(() => true).catch(() => false)
      };
      res.json(RestResult.single(record));
    } catch {
      res.status(404).json(RestResult.error('Backup folder not found'));
    }
  }
};

export default databaseController;
