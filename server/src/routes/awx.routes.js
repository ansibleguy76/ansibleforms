const express = require('express')
const router = express.Router()
const awxController =   require('../controllers/awx.controller');

// run a playbook
router.post('/', awxController.launch);
router.get('/:id', awxController.getJob);
module.exports = router
