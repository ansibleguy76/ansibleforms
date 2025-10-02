import express from 'express';
const router = express.Router();
import versionController from '../controllers/version.controller.js';

// check the app version
router.get('/', versionController.get);

export default router
