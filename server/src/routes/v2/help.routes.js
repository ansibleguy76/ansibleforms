import express from 'express';
const router = express.Router();
import helpController from '../../controllers/v2/help.controller.js';

// get help data
router.get('/', helpController.get);

export default router
