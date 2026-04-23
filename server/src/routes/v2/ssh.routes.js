import express from 'express';
const router = express.Router();
import sshController from '../../controllers/v2/ssh.controller.js';

// admin routes for ssh (config/gui)
// get ssh config
router.get('/', sshController.find);
// set ssh config
router.put('/', sshController.update);
export default router
