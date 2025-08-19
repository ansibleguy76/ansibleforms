import express from 'express';
const router = express.Router();
import awxController from '../controllers/awx.controller.v2.js';

// Retrieve all AWX or by name
router.get('/', awxController.find);
// Create a new AWX
router.post('/', awxController.create);
// Retrieve a single AWX by id
router.get('/:id', awxController.findById);
// Update an AWX by id
router.put('/:id', awxController.update);
// Delete an AWX by id
router.delete('/:id', awxController.delete);
// Check AWX config (if needed)
router.post('/:id/check', awxController.check);

export default router
