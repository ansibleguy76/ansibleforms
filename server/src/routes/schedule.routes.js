const express = require('express')
const router = express.Router()
const scheduleController =   require('../controllers/schedule.controller');
// Retrieve all schedules
router.get('/', scheduleController.findAllOr1);
// Create a new schedule
router.post('/', scheduleController.create);
// Retrieve a single schedule with id
router.get('/:id', scheduleController.findById);
// Update a schedule with id
router.put('/:id', scheduleController.update);
// Delete a schedule with id
router.delete('/:id', scheduleController.delete);
// reset a schedule by name
router.post('/:id/launch/', scheduleController.launch);

module.exports = router
