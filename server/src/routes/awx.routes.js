const express = require('express')
const router = express.Router()
const awxController =   require('../controllers/awx.controller');
const checkAdminMiddleware = require('../lib/common.js').checkAdminMiddleware;
// Retrieve awx config
router.get('/',checkAdminMiddleware, awxController.find);
// Set awx config
router.put('/',checkAdminMiddleware, awxController.update);
// Test awx config
router.post('/check/',checkAdminMiddleware, awxController.check);
// run a template
router.post('/launch/', awxController.launch);
router.post('/job/:id/abort/', awxController.abortJob);
router.get('/job/:id', awxController.getJob);
module.exports = router
