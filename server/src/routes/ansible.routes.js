const express = require('express')
const router = express.Router()
const ansibleController =   require('../controllers/ansible.controller');

// run a playbook
router.post('/', ansibleController.run);
module.exports = router
