import express from 'express';
import tokenController from '../../controllers/v2/token.controller.js';
const router = express.Router();

// refresh tokens
router.post('/', tokenController.refresh);
export default router
