const express = require('express')
const router = express.Router()
const loginController = require("../controllers/login.controller.js")

// login with username and password (basic authentication)
router.post('/login',loginController.login);
module.exports = router
