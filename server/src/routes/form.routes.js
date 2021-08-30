const express = require('express')
const router = express.Router()
const formController =   require('../controllers/form.controller');

// run a playbook
router.get('/', formController.findAll);
module.exports = router
