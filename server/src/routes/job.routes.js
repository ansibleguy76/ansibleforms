const express = require('express')
const router = express.Router()
const jobController =   require('../controllers/job.controller');
// Retrieve all jobs
router.get('/', jobController.findAll);
// Retrieve a single job with id
router.get('/:id', jobController.findById);
// Delete a job with id
router.delete('/:id', jobController.delete);

module.exports = router
