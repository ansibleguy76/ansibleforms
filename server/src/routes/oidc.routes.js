import express from 'express';
import oidcController from '../controllers/oidc.controller.js';
const router = express.Router();
// Retrieve oidc
router.get('/', oidcController.find);
// Set oidc
router.put('/', oidcController.update);
// Test oidc
router.post('/check/', oidcController.check);

export default router
