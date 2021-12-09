const express = require('express')
const router = express.Router()
const ansibleController =   require('../controllers/ansible.controller');

// run a playbook
router.post('/launch/', ansibleController.run);
// get a single job
router.get('/job/:id', ansibleController.getJob);
// change a single job (status changes)
router.put('/job/:id', ansibleController.updateJob);
// delete a single job
router.delete('/job/:id', ansibleController.deleteJob);
// abort a single job (set status to abort)
router.post('/job/:id/abort/', ansibleController.abortJob);
// get all jobs
router.get('/jobs/', ansibleController.findAllJobs);

module.exports = router
