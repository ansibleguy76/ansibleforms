const express = require('express')
const router = express.Router()
const queryController =   require('../controllers/query.controller');
// Retrieve all surveys
router.post('/', queryController.findAll);
module.exports = router
