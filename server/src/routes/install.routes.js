import express from 'express';
const router = express.Router();
import installController from '../controllers/install.controller.js';

// check the app version
router.get('/', installController.performChecks);

export default router
