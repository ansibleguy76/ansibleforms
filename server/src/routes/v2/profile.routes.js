import express from 'express';
const router = express.Router();
import userController from '../../controllers/v2/user.controller.js';
import apiTokenController from '../../controllers/v2/apiToken.controller.js';
import { authRateLimit } from '../../lib/authRateLimit.js';
// the routes that check a password or hand out a token : the same ceiling per address as the
// sign-in (lib/authRateLimit.js), a count of their own ; reading the profile is not limited. A
// wrong current password also counts toward the account lockout (user.controller.js)
const limiter = authRateLimit();
// Retrieve profile
router.get('/', userController.find);
// Update password
router.put('/', limiter, userController.changePassword);
// the user's api tokens : made from this session, listed, revoked (#1068)
router.get('/tokens', apiTokenController.findMine);
router.post('/tokens', limiter, apiTokenController.create);
router.delete('/tokens/:sid', limiter, apiTokenController.revokeMine);

export default router
