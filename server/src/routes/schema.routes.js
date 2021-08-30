const express = require('express')
const router = express.Router()
const schemaController =   require('../controllers/schema.controller');
// Retrieve all users

router.get('/', schemaController.hasSchema);
router.post('/', schemaController.create);

module.exports = router
