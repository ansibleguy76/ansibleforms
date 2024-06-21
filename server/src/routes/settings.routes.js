const express = require('express')
const router = express.Router()
const settingsController =   require('../controllers/settings.controller');
// Retrieve settings
router.get('/', settingsController.find);
// Set settings
router.put('/', settingsController.update);
// Load forms from yaml
router.put('/importFormsFileFromYaml', settingsController.importFormsFileFromYaml);
// Test settings
router.post('/mailcheck/', settingsController.mailcheck);

module.exports = router
