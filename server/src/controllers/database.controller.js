import Cmd from '../lib/cmd.js';
import dbConfig from '../../config/db.config.js';
import { promises as fs } from 'fs';
import path from 'path';
import RestResult from '../models/restResult.model.v2.js';
import appConfig from '../../config/app.config.js';

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

const databaseController = {
  async backup(req, res) {
    const dbName = 'AnsibleForms';
    const dbHost = dbConfig.host;
    const dbUser = dbConfig.user;
    const dbPassword = dbConfig.password;
    const dbPort = dbConfig.port;

    const { backupFolder, backupFile, timestamp } = getBackupPaths();
    await fs.mkdir(backupFolder, { recursive: true });

    // Properly quote password for shell
    const safePassword = dbPassword.replace(/'/g, `"'"'`);
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
      res.json(RestResult.single({
        message: 'Backup created',
        backupFolder,
        backupFile,
        timestamp
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

    // Accept folder in body or query, use to assemble restore folder (relative to backupPath)
    const folder = req.body.folder || req.query.folder;
    let restoreFolder;
    if (folder) {
      restoreFolder = path.join(appConfig.backupPath, folder);
    } else {
      // Use latest backup folder
      const folders = (await fs.readdir(appConfig.backupPath)).filter(f => /^\d{14}$/.test(f));
      if (!folders.length) {
        return res.status(404).json(RestResult.error('No backup folders found'));
      }
      restoreFolder = path.join(appConfig.backupPath, folders.sort().reverse()[0]);
    }
    const backupFile = path.join(restoreFolder, 'ansibleforms.sql');
    const formsFile = appConfig.formsPath;
    const formsYamlBackup = path.join(restoreFolder, path.basename(formsFile));
    const formsDir = path.join(path.dirname(formsFile), 'forms');
    const formsDirBackup = path.join(restoreFolder, 'forms');

    // Restore DB
    const safePassword = dbPassword.replace(/'/g, `"'"'`);
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
      const records = await Promise.all(folders.map(async folder => {
        const backupFolder = path.join(appConfig.backupPath, folder);
        const backupFile = path.join(backupFolder, 'ansibleforms.sql');
        const formsYaml = path.join(backupFolder, path.basename(appConfig.formsPath));
        const formsDir = path.join(backupFolder, 'forms');
        return {
          folder,
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
  }
};

export default databaseController;
