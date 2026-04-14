import express from 'express';
const router = express.Router();
import storedJobsController from '../../controllers/v2/stored-jobs.controller.js';

// Retrieve all stored jobs (filtered by user)
router.get('/', storedJobsController.find);

// Create a new stored job
router.post('/', storedJobsController.create);

// Retrieve a single stored job with id
router.get('/:id', storedJobsController.findById);

// Update a stored job with id
router.put('/:id', storedJobsController.update);

// Delete a stored job with id
router.delete('/:id', storedJobsController.delete);

export default router;
