const express = require('express')
const tokenController =   require('../controllers/token.controller');
const router = express.Router()

// refresh tokens
router.post('/', tokenController.refresh);
module.exports = router
