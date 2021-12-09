const express = require('express')
const router = express.Router()
const schemaController =   require('../controllers/schema.controller');

// check the database schema
router.get('/', schemaController.hasSchema);
// create the database schema
router.post('/', schemaController.create);

module.exports = router
