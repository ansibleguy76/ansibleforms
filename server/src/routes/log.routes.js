const express = require('express')
const router = express.Router()
const logController =   require('../controllers/log.controller');

// get a job
router.get('/', logController.get);
// download a log file
router.get('/download', logController.download);

module.exports = router
