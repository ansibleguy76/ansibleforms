const express = require('express')
const router = express.Router()
const versionController =   require('../controllers/version.controller');

// check the app version
router.get('/', versionController.get);

module.exports = router
