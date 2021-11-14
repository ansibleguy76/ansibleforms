const express = require('express')
const router = express.Router()
const awxController =   require('../controllers/awx.controller');

// run a playbook
router.post('/launch/', awxController.launch);
router.get('/job/:id', awxController.getJob);
module.exports = router
