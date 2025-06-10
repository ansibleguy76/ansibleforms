import express from 'express';
const router = express.Router();
import awxController from '../controllers/awx.controller.js';

// get awx config
router.get('/', awxController.find);
// set awx config
router.put('/', awxController.update);
// check awx config
router.post('/check/', awxController.check);

export default router
