const express = require('express')
const router = express.Router()
const gitController =   require('../controllers/git.controller');

router.post('/pull', gitController.pull);

module.exports = router
