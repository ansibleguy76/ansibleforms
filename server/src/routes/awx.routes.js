const express = require('express')
const router = express.Router()
const awxController =   require('../controllers/awx.controller');
const checkAdminMiddleware = require('../lib/common.js').checkAdminMiddleware;

// admin routes for awx (config/gui)
// get awx config
router.get('/',checkAdminMiddleware, awxController.find);
// set awx config
router.put('/',checkAdminMiddleware, awxController.update);
// check awx config
router.post('/check/',checkAdminMiddleware, awxController.check);

// action routes for awx (no admin)
// launch template
router.post('/launch/', awxController.launch);
// abort single job
// router.post('/job/:id/abort/', awxController.abortJob);
// get single job
// router.get('/job/:id', awxController.getJob);
module.exports = router
