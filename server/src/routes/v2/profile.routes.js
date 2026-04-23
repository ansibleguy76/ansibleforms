import express from 'express';
const router = express.Router();
import userController from '../../controllers/v2/user.controller.js';
// Retrieve profile
router.get('/', userController.find);
// Update password
router.put('/', userController.changePassword);

export default router
