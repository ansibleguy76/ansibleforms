import express from 'express';
import Middleware from '../../lib/middleware.js';
import settingsController from '../../controllers/v2/settings.controller.js';

const router = express.Router();
// Retrieve settings
// the settings row : any part of the settings, each field checked (lib/settingsSections.js) ; the
// rest only with every setting
router.get('/', settingsController.find);
// Set settings
router.put('/', settingsController.update);
// Active config (reads/writes from the source set in config_source)
router.get('/config', Middleware.checkSettingsMiddleware, settingsController.getConfig);
router.put('/config', Middleware.checkSettingsMiddleware, settingsController.saveConfig);
// Import config (from config.yaml)
router.put('/importConfig', Middleware.checkSettingsMiddleware, settingsController.importConfig);
// Export config (from database to config.yaml)
router.put('/exportConfig', Middleware.checkSettingsMiddleware, settingsController.exportConfig);
// Test settings
router.post('/mailcheck/', Middleware.checkSettingsMiddleware, settingsController.mailcheck);

export default router
