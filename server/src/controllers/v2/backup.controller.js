import Errors from '../../lib/errors.js';
import Audit from '../../models/audit.model.js';
import BackupModel from '../../models/backup.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';
import logger from '../../lib/logger.js';


const backupController = {
  async backup(req, res) {
    try {
      const desc = req.body?.description;
      const result = await BackupModel.doBackup(desc);
      res.json(RestResult.single({ message: i18n.t(req, 'resources.backupCreated'), ...result }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async restore(req, res) {
    try {
      const folder = req.params.folder;
      const backupFirst = req.query.backupFirst === 'true' || req.query.backupFirst === true;
      const result = await BackupModel.restore(folder, backupFirst);
      // a restore replaces the entire database : the most consequential single action
      // in the product, so it gets a semantic entry naming the snapshot used
      Audit.log({ user: req.user?.user, ip: req.ip, action: 'backup.restore', targetType: 'backup', target: folder, detail: { backupFirst } });
      res.json(RestResult.single(result));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  // The environment file is captured by every backup but NOT restored with it, because
  // DB_HOST, the paths and the TLS locations in it describe the machine the backup came from.
  // This is the explicit opt-in counterpart - without it the file could be backed up and
  // never put back through the product at all.
  async restoreEnv(req, res) {
    try {
      const folder = req.params.folder;
      const result = await BackupModel.restoreManagedEnv(folder);
      Audit.log({
        user: req.user?.user, ip: req.ip,
        action: 'backup.restoreEnv',
        outcome: result.restored ? 'success' : 'failure',
        targetType: 'backup', target: folder,
        // never the values : this file holds VAULT_TOKEN and DB_PASSWORD
        detail: { restored: result.restored, reason: result.reason || null },
      });
      res.json(RestResult.single(result));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async listBackups(req, res) {
    try {
      const records = await BackupModel.listBackups();
      res.json(RestResult.list(records));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async deleteBackup(req, res) {
    try {
      const folder = req.params.folder;
      const result = await BackupModel.deleteBackup(folder);
      res.json(RestResult.single(result));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async getBackupByFolder(req, res) {
    try {
      const folder = req.params.folder;
      const record = await BackupModel.getBackupByFolder(folder);
      res.json(RestResult.single(record));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  // The backup folder as a .tar.gz, streamed (BackupModel.archiveBackup) : to keep a copy off the
  // host, or to restore it on another one. The folder name is checked (and the folder looked
  // up) BEFORE anything is sent, so a bad or unknown one is still an ordinary JSON error.
  async download(req, res) {
    try {
      const folder = req.params.folder;
      const { stream, fileName } = await BackupModel.archiveBackup(folder);
      // a download carries the whole database out of the host (its stored credentials
      // encrypted, the environment file's other credentials as they are) : who took it is kept
      Audit.log({ user: req.user?.user, ip: req.ip, action: 'backup.download', targetType: 'backup', target: folder });
      res.set('Content-Type', 'application/gzip');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      // a failure midway (a file that cannot be read) : the status line is sent already, so
      // the connection is cut and the browser sees a failed download rather than a short archive
      stream.on('error', (err) => {
        logger.error(`Downloading backup '${folder}' failed: ${err.message || err}`);
        res.destroy(err);
      });
      stream.pipe(res);
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async reset(req, res) {
    // TODO: Implement reset logic
    res.json(RestResult.single({ message: 'Database reset (stub)' }));
  }
};

export default backupController;
