const express = require('express')
const router = express.Router()
const sshController =   require('../controllers/ssh.controller');

// admin routes for ssh (config/gui)
// get ssh config
router.get('/', sshController.find);
// set ssh config
router.put('/', sshController.update);
module.exports = router
