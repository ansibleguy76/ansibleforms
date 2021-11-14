const express = require('express')
const router = express.Router()
const awxController =   require('../controllers/awx.controller');
// Retrieve awx config
router.get('/', awxController.find);
// Set awx config
router.put('/', awxController.update);
// Test awx config
router.post('/check/', awxController.check);
module.exports = router
