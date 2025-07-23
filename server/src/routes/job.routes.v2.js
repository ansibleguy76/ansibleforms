import express from 'express';
const router = express.Router();
import jobControllerv2 from '../controllers/job.controller.v2.js';
import uploadController from '../controllers/upload.controller.js';

// get approvals count
router.get('/approvals', jobControllerv2.findApprovals);
// upload file
router.post('/upload',uploadController.upload)
// get a job
router.get('/:id', jobControllerv2.getJob);
// download a job
router.get('/:id/download', jobControllerv2.download);
// delete a job
router.delete('/:id', jobControllerv2.deleteJob);
// launch job
router.post('/', jobControllerv2.launch);
// abort a job
router.post('/:id/abort/', jobControllerv2.abortJob);
// relaunch a job
router.post('/:id/relaunch/', jobControllerv2.relaunchJob);
// approve a job
router.post('/:id/approve/', jobControllerv2.approveJob);
// approve a job
router.post('/:id/reject/', jobControllerv2.rejectJob);
// get all jobs
router.get('/', jobControllerv2.findAllJobs);


export default router
