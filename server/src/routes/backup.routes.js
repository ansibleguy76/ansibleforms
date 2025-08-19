import express from 'express';
import backupController from '../controllers/backup.controller.js';
import middleware from '../lib/middleware.js';

const router = express.Router();

// POST /backups (create backup)
router.post('/', middleware.checkBackupMiddleware, backupController.backup);

// POST /backup/restore (restore backup)
router.post('/:folder/restore', middleware.checkBackupMiddleware, backupController.restore);

// GET /backup (list backups)
router.get('/', middleware.checkBackupMiddleware, backupController.listBackups);

// GET /backup/:folder (get single backup)
router.get('/:folder', middleware.checkBackupMiddleware, backupController.getBackupByFolder);

// DELETE /backup
router.delete('/:folder', middleware.checkBackupMiddleware, backupController.deleteBackup);

export default router;
