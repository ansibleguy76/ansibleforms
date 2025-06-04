const express = require('express')
const router = express.Router()
const datasourceController =   require('../controllers/datasource.controller');
// Retrieve all datasources
router.get('/', datasourceController.findAllOr1);
// Create a new datasource
router.post('/', datasourceController.create);
// Retrieve a single datasource with id
router.get('/:id', datasourceController.findById);
// Update a datasource with id
router.put('/:id', datasourceController.update);
// Delete a datasource with id
router.delete('/:id', datasourceController.delete);
// reset a datasource by name
router.post('/:id/import/', datasourceController.import);

module.exports = router
