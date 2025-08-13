import express from 'express';
import databaseController from '../controllers/database.controller.js';
import middleware from '../lib/middleware.js';

const router = express.Router();

// POST /database/backup
router.post('/backup', middleware.checkDatabaseMiddleware, databaseController.backup);

// POST /database/restore
router.post('/restore', middleware.checkDatabaseMiddleware, databaseController.restore);

// POST /database/reset
router.post('/reset', middleware.checkDatabaseMiddleware, databaseController.reset);

// GET /database/ (list backups)
router.get('/', middleware.checkDatabaseMiddleware, databaseController.listBackups);

export default router;
