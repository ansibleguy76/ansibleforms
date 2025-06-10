import express from 'express';
import logController from '../controllers/log.controller.js';

const router = express.Router();

// get a job
router.get('/', logController.get);
// download a log file
router.get('/download', logController.download);

export default router
