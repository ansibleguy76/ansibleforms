const express = require('express')
const router = express.Router()
const oidcController =   require('../controllers/oidc.controller');
// Retrieve oidc
router.get('/', oidcController.find);
// Set oidc
router.put('/', oidcController.update);
// Test oidc
router.post('/check/', oidcController.check);

module.exports = router
