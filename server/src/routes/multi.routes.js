const express = require('express')
const router = express.Router()
const multiController =   require('../controllers/multi.controller');

// push to git
router.post('/launch', multiController.launch);

module.exports = router
