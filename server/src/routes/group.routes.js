import express from 'express';
const router = express.Router();
import groupController from '../controllers/group.controller.js';
// Retrieve all groups
router.get('/', groupController.find);
// Create a new group
router.post('/', groupController.create);
// Retrieve a single group with id
router.get('/:id', groupController.findById);
// Update a group with id
router.put('/:id', groupController.update);
// Delete a group with id
router.delete('/:id', groupController.delete);

export default router
