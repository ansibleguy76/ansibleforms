const express = require('express')
const router = express.Router()
const loginController = require("../controllers/login.controller.js")


// login with username and password (basic authentication)
router.post('/login',loginController.basic,loginController.basic_ldap);
router.get('/settings',loginController.settings);
router.get('/azureadoauth2',loginController.azureadoauth2,loginController.errorHandler);
router.get('/azureadoauth2/callback',loginController.azureadoauth2callback,loginController.errorHandler);
router.post('/azureadoauth2/login',loginController.azureadoauth2login,loginController.errorHandler);
module.exports = router
