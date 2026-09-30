import express from 'express';
import chatSettingsController from '../../controllers/v2/chatSettings.controller.js';

const router = express.Router();
router.get('/', chatSettingsController.find);
router.put('/', chatSettingsController.update);
router.post('/check/', chatSettingsController.check);

export default router
