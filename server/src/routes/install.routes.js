const express = require('express')
const router = express.Router()
const installController = require('../controllers/install.controller');

// check the app version
router.get('/', installController.performChecks);

module.exports = router
