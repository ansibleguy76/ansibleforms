const express = require('express')
const router = express.Router()
const formController =   require('../controllers/config.controller');

// run a playbook
router.get('/', formController.findAll);
router.post('/', formController.save);
router.post('/check', formController.validate);
module.exports = router
