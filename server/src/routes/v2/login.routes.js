import express from 'express';
const router = express.Router();
import loginController from "../../controllers/v2/login.controller.js";


// login with username and password (basic authentication)
router.post('/login',loginController.basic,loginController.basic_ldap);
router.get('/logout', loginController.logout)
// with the refresh token in the body, so it goes too
router.post('/logout', loginController.logout)
router.get('/settings',loginController.settings);

// Microsoft Entra ID
router.get('/entraid',loginController.entraid,loginController.errorHandler);
router.get('/entraid/callback',loginController.entraidCallback,loginController.errorHandler);
router.post('/entraid/login',loginController.entraidLogin,loginController.errorHandler);
// the paths of before 7.3, the same handlers (deprecated, removed in 8.0) : a provider saved
// with the old redirect uri comes back on /azureadoauth2/callback
router.get('/azureadoauth2',loginController.entraid,loginController.errorHandler);
router.get('/azureadoauth2/callback',loginController.entraidCallback,loginController.errorHandler);
router.post('/azureadoauth2/login',loginController.entraidLogin,loginController.errorHandler);

// Open ID Connect
router.get('/oidc',loginController.oidc,loginController.errorHandler);
router.get('/oidc/callback',loginController.oidcCallback,loginController.errorHandler);
router.post('/oidc/login',loginController.oidcLogin,loginController.errorHandler);

export default router
