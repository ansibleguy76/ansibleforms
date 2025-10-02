import express from 'express';
import settingsController from '../controllers/settings.controller.js';

const router = express.Router();
// Retrieve settings
router.get('/', settingsController.find);
// Set settings
router.put('/', settingsController.update);
// Load forms from yaml
router.put('/importFormsFileFromYaml', settingsController.importFormsFileFromYaml);
// Test settings
router.post('/mailcheck/', settingsController.mailcheck);

export default router
