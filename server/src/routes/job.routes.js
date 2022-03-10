const express = require('express')
const router = express.Router()
const jobController =   require('../controllers/job.controller');

// get a job
router.get('/:id', jobController.getJob);
// change a job (status changes)
router.put('/:id', jobController.updateJob);
// delete a job
router.delete('/:id', jobController.deleteJob);
// abort a job
router.post('/:id/abort/', jobController.abortJob);
// get all jobs
router.get('/', jobController.findAllJobs);

module.exports = router