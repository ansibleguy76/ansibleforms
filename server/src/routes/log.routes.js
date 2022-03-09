const express = require('express')
const router = express.Router()
const logController =   require('../controllers/log.controller');

// get a job
router.get('/', logController.get);

module.exports = router
