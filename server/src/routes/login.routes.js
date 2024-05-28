const express = require('express')
const router = express.Router()
const loginController = require("../controllers/login.controller.js")


// login with username and password (basic authentication)
router.post('/login',loginController.basic,loginController.basic_ldap);
router.get('/logout', loginController.logout)
router.get('/settings',loginController.settings);

// Microsoft Entra ID
router.get('/azureadoauth2',loginController.azureadoauth2,loginController.errorHandler);
router.get('/azureadoauth2/callback',loginController.azureadoauth2callback,loginController.errorHandler);
router.post('/azureadoauth2/login',loginController.azureadoauth2login,loginController.errorHandler);

// Open ID Connect
router.get('/oidc',loginController.oidc,loginController.errorHandler);
router.get('/oidc/callback',loginController.oidcCallback,loginController.errorHandler);
router.post('/oidc/login',loginController.oidcLogin,loginController.errorHandler);

module.exports = router
