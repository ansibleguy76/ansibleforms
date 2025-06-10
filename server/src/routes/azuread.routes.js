import express from 'express';
import azureadController from '../controllers/azuread.controller.js';

const router = express.Router();
// Retrieve azuread
router.get('/', azureadController.find);
// Set azuread
router.put('/', azureadController.update);
// Test azuread
router.post('/check/', azureadController.check);

export default router
