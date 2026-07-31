import express from 'express';
import backupController from '../../controllers/v2/backup.controller.js';
import middleware from '../../lib/middleware.js';

const router = express.Router();

// POST /backups (create backup)
router.post('/', middleware.checkBackupMiddleware, backupController.backup);

// POST /backup/restore (restore backup)
router.post('/:folder/restore', middleware.checkBackupMiddleware, backupController.restore);

// POST /backup/:folder/restore-env (restore ONLY the environment file, opt-in)
// Separate from /restore on purpose : a normal restore must never move the environment
// file, because it describes the host the backup was taken on.
router.post('/:folder/restore-env', middleware.checkBackupMiddleware, backupController.restoreEnv);

// GET /backup (list backups)
router.get('/', middleware.checkBackupMiddleware, backupController.listBackups);

// GET /backup/:folder (get single backup)
router.get('/:folder', middleware.checkBackupMiddleware, backupController.getBackupByFolder);

// DELETE /backup
router.delete('/:folder', middleware.checkBackupMiddleware, backupController.deleteBackup);

export default router;
