const express = require('express')
const router = express.Router()
const lockController =   require('../controllers/lock.controller');

// check the app version
router.get('/', lockController.status);
router.post('/', lockController.set);
router.delete('/', lockController.delete);

module.exports = router
