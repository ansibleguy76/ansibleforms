const express = require('express')
const router = express.Router()
const ansibleController =   require('../controllers/ansible.controller');

// run a playbook
router.post('/launch', ansibleController.run);
router.get('/job/:id', ansibleController.getJob);
module.exports = router
