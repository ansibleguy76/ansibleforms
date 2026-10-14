import express from 'express';
const router = express.Router();
import userController from '../../controllers/v2/user.controller.js';
import apiTokenController from '../../controllers/v2/apiToken.controller.js';
// Retrieve profile
router.get('/', userController.find);
// Update password
router.put('/', userController.changePassword);
// the user's api tokens : made from this session, listed, revoked (#1068)
router.get('/tokens', apiTokenController.findMine);
router.post('/tokens', apiTokenController.create);
router.delete('/tokens/:sid', apiTokenController.revokeMine);

export default router
