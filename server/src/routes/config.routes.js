const express = require('express')
const router = express.Router()
const configController =   require('../controllers/config.controller');
const checkDesignerMiddleware = require('../lib/common.js').checkDesignerMiddleware;
const checkSettingsMiddleware = require('../lib/common.js').checkSettingsMiddleware;

// designer routes only (admin !!)
router.post('/', checkDesignerMiddleware, configController.save);
router.post('/check', checkDesignerMiddleware, configController.validate);
router.post('/restore/:backupName', checkDesignerMiddleware, configController.restore);
router.get('/backups', checkDesignerMiddleware, configController.backups);
router.get('/env', checkSettingsMiddleware, configController.env);

// get the config (no admin)
router.get('/', configController.findAll);
module.exports = router
