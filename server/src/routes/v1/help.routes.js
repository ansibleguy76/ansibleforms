import express from 'express';
const router = express.Router();
import helpController from '../../controllers/v1/help.controller.js';

// check the app version
router.get('/', helpController.get);

export default router
