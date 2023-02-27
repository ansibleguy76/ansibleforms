const express = require('express')
const router = express.Router()
const azureadController =   require('../controllers/azuread.controller');
// Retrieve azuread
router.get('/', azureadController.find);
// Set azuread
router.put('/', azureadController.update);
// Test azuread
router.post('/check/', azureadController.check);

module.exports = router
