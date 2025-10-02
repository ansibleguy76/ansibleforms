import express from 'express';
const router = express.Router();
import helpController from '../controllers/help.controller.js';

// check the app version
router.get('/', helpController.get);

export default router
