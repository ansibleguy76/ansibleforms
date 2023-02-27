const express = require('express')
const router = express.Router()
const configController =   require('../controllers/config.controller');
const checkAdminMiddleware = require('../lib/common.js').checkAdminMiddleware;

// designer routes only (admin !!)
router.post('/', checkAdminMiddleware, configController.save);
router.post('/check', checkAdminMiddleware, configController.validate);
router.post('/restore/:backupName', checkAdminMiddleware, configController.restore);
router.get('/backups', checkAdminMiddleware, configController.backups);
router.get('/env', checkAdminMiddleware, configController.env);

// get the config (no admin)
router.get('/', configController.findAll);
module.exports = router
