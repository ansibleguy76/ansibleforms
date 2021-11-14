const express = require('express')
const router = express.Router()
const ldapController =   require('../controllers/ldap.controller');
// Retrieve ldap
router.get('/', ldapController.find);
// Set ldap
router.put('/', ldapController.update);
// Test ldap
router.post('/check/', ldapController.check);

module.exports = router
