const express = require('express')
const router = express.Router()
const formController =   require('../controllers/config.controller');

// modify forms.yaml
router.post('/', formController.save);
router.post('/check', formController.validate);
module.exports = router
