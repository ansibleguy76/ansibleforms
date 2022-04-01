const express = require('express')
const router = express.Router()
const awxController =   require('../controllers/awx.controller');

// get awx config
router.get('/', awxController.find);
// set awx config
router.put('/', awxController.update);
// check awx config
router.post('/check/', awxController.check);

module.exports = router
