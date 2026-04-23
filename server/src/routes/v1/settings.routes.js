import express from 'express';
import settingsController from '../../controllers/v1/settings.controller.js';

const router = express.Router();
// Retrieve settings
router.get('/', settingsController.find);
// Set settings
router.put('/', settingsController.update);
// Import config (from config.yaml or forms.yaml)
router.put('/importConfig', settingsController.importConfig);
// Test settings
router.post('/mailcheck/', settingsController.mailcheck);

export default router
