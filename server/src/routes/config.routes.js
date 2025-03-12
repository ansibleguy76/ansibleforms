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
// get list, just the icons and names (no admin)
router.get('/formlist', configController.findList);
// get one config (no admin)
router.get('/form', configController.findOne);
// 
module.exports = router
