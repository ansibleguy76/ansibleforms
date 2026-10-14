import express from 'express';
const router = express.Router();
import userController from '../../controllers/v2/user.controller.js';
import apiTokenController from '../../controllers/v2/apiToken.controller.js';
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
// A user's groups besides its first one : add one, remove one (a user keeps one)
router.post('/:id/groups', userController.addGroup);
// block (body { blocked: true }) or allow its sign-in
router.post('/:id/block', userController.setBlocked);
// its api tokens : listed, one revoked (#1068)
router.get('/:id/tokens', apiTokenController.findForUser);
router.delete('/:id/tokens/:sid', apiTokenController.revokeForUser);
router.delete('/:id/groups/:groupId', userController.removeGroup);

export default router
