const express = require('express')
const router = express.Router()
const expressionController =   require('../controllers/expression.controller');

// execute a javascript expression
router.post('/', expressionController.execute);
module.exports = router
