import express from 'express';
import tokenController from '../controllers/token.controller.js';
const router = express.Router();

// refresh tokens
router.post('/', tokenController.refresh);
export default router
