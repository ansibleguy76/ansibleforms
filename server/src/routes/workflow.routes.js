const express = require('express')
const router = express.Router()
const workflowController =   require('../controllers/workflow.controller');

// push to git
router.post('/launch', workflowController.launch);

module.exports = router
