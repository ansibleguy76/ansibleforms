import express from 'express';
const router = express.Router();
import configController from '../controllers/config.controller.js';
import middleware from '../lib/middleware.js';

// designer routes only (admin !!)
router.post('/', middleware.checkDesignerMiddleware, configController.save);
router.post('/check', middleware.checkDesignerMiddleware, configController.validate);
router.post('/restore/:backupName', middleware.checkDesignerMiddleware, configController.restore);
router.get('/backups', middleware.checkDesignerMiddleware, configController.backups);
router.get('/env', middleware.checkSettingsMiddleware, configController.env);

// get the config (no admin)
router.get('/', middleware.checkDesignerMiddleware, configController.findAll);
// get list, just the icons and names (no admin)
router.get('/formlist', configController.findList);
// get one config (no admin)
router.get('/form', configController.findOne);
// 
export default router
