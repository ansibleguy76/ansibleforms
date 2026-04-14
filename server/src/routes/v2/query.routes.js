import express from 'express';
const router = express.Router();
import queryController from '../../controllers/v2/query.controller.js';

// run a database query
router.post('/', queryController.findAll);
export default router
