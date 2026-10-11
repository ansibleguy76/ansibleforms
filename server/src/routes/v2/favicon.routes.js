import express from 'express';
import passport from 'passport';
import faviconController from '../../controllers/v2/favicon.controller.js';
import Middleware from '../../lib/middleware.js';

const router = express.Router();

// the website icon shows in the browser tab before anyone signs in, so reading it is public ;
// changing it needs an authenticated user with settings access (as the logo)
const authenticate = passport.authenticate("jwt", { session: false });

router.get('/', faviconController.get);
router.post('/', authenticate, Middleware.checkSettingsMiddleware, faviconController.update);
router.delete('/', authenticate, Middleware.checkSettingsMiddleware, faviconController.remove);

export default router
