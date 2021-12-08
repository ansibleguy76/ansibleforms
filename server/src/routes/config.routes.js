const express = require('express')
const router = express.Router()
const configController =   require('../controllers/config.controller');
const formController =   require('../controllers/form.controller');
const checkAdminMiddleware = require('../lib/common.js').checkAdminMiddleware;

// run a playbook
router.get('/', formController.findAll);

// modify forms.yaml
router.post('/', checkAdminMiddleware, configController.save);
router.post('/check', checkAdminMiddleware, configController.validate);
module.exports = router
