const express = require('express')
const logger=require("../lib/logger")
const router = express.Router()
const jobController =   require('../controllers/job.controller');
const uploadController =   require('../controllers/upload.controller');

// get approvals count
router.get('/approvals', jobController.findApprovals);
// upload file
router.post('/upload',uploadController.upload)
// get a job
router.get('/:id', jobController.getJob);
// download a job
router.get('/:id/download', jobController.download);
// delete a job
router.delete('/:id', jobController.deleteJob);
// launch job
router.post('/', jobController.launch);
// abort a job
router.post('/:id/abort/', jobController.abortJob);
// relaunch a job
router.post('/:id/relaunch/', jobController.relaunchJob);
// approve a job
router.post('/:id/approve/', jobController.approveJob);
// approve a job
router.post('/:id/reject/', jobController.rejectJob);
// get all jobs
router.get('/', jobController.findAllJobs);


module.exports = router
