const express = require('express')
const router = express.Router()
const multistepController =   require('../controllers/multistep.controller');

// push to git
router.post('/launch', multistepController.launch);

module.exports = router
