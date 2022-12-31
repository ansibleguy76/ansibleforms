const express = require('express')
const router = express.Router()
const helpController = require('../controllers/help.controller');

// check the app version
router.get('/', helpController.get);

module.exports = router
