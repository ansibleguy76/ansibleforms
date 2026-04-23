import express from 'express';
const router = express.Router();
import expressionController from '../../controllers/v2/expression.controller.js';

// execute a javascript expression
router.post('/', expressionController.execute);
export default router
