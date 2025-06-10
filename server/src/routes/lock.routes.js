import express from 'express';
const router = express.Router();
import lockController from '../controllers/lock.controller.js';

// check the app version
router.get('/', lockController.status);
router.post('/', lockController.set);
router.delete('/', lockController.delete);

export default router
