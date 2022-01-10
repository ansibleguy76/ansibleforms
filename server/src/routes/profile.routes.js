const express = require('express')
const router = express.Router()
const userController = require('../controllers/user.controller');
// Retrieve profile
router.get('/', userController.find);
// Update password
router.put('/', userController.changePassword);

module.exports = router
