
import Errors from '../lib/errors.js';
import BackupModel from '../models/backup.model.js';
import RestResult from '../models/restResult.model.v2.js';


const backupController = {
  async backup(req, res) {
    try {
      const desc = req.body?.description;
      const result = await BackupModel.doBackup(desc);
      res.json(RestResult.single({ message: 'Backup created', ...result }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },
  async restore(req, res) {
    try {
      const folder = req.params.folder;
      const backupFirst = req.query.backupFirst === 'true' || req.query.backupFirst === true;
      const result = await BackupModel.restore(folder, backupFirst);
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
  async reset(req, res) {
    // TODO: Implement reset logic
    res.json(RestResult.single({ message: 'Database reset (stub)' }));
  }
};

export default backupController;
