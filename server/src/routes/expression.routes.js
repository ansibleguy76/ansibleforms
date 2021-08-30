const express = require('express')
const router = express.Router()
const expressionController =   require('../controllers/expression.controller');

// run a playbook
router.post('/', expressionController.execute);
module.exports = router
