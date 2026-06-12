import express from 'express';
import logoController from '../../controllers/v2/logo.controller.js';
import Middleware from '../../lib/middleware.js';

const router = express.Router();

// get the custom logo (any authenticated user, the navbar shows it)
router.get('/', logoController.get);
// upload a new custom logo (settings access only)
router.post('/', Middleware.checkSettingsMiddleware, logoController.update);
// remove the custom logo and fall back to the default (settings access only)
router.delete('/', Middleware.checkSettingsMiddleware, logoController.remove);

export default router
