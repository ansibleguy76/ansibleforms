import express from 'express';
const router = express.Router();
import syslogServerController from '../../controllers/v2/syslogServer.controller.js';

router.get('/', syslogServerController.find);
router.post('/', syslogServerController.create);
router.get('/:id', syslogServerController.findById);
router.put('/:id', syslogServerController.update);
router.delete('/:id', syslogServerController.delete);
// a test message through the saved server
router.post('/:id/test', syslogServerController.test);

export default router
