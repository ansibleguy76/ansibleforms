const express = require('express')
const router = express.Router()
const queryController =   require('../controllers/query.controller');

// run a database query
router.post('/', queryController.findAll);
module.exports = router
