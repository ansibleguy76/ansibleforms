import express from 'express';
const router = express.Router();
import userController from '../controllers/user.controller.js';
// Retrieve all users
router.get('/', userController.findAllOr1);
// Create a new user
router.post('/', userController.create);
// Retrieve a single user with id
router.get('/:id', userController.findById);
// Update a user with id
router.put('/:id', userController.update);
// Delete a user with id
router.delete('/:id', userController.delete);

export default router
