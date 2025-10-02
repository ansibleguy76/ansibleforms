import express from 'express';
import logger from '../lib/logger.js';
const router = express.Router();
import jobController from '../controllers/job.controller.js';
import uploadController from '../controllers/upload.controller.js';

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


export default router
