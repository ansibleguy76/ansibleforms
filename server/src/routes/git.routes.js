const express = require('express')
const router = express.Router()
const gitController =   require('../controllers/git.controller');

// push to git
router.post('/push', gitController.push);
router.post('/pull', gitController.pull);

module.exports = router
