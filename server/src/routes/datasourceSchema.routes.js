const express = require('express')
const router = express.Router()
const datasourceSchemaController =   require('../controllers/datasourceSchema.controller');
// Retrieve all datasourceSchemas
router.get('/', datasourceSchemaController.findAllOr1);
// Create a new datasourceSchema
router.post('/', datasourceSchemaController.create);
// Retrieve a single datasourceSchema with id
router.get('/:id', datasourceSchemaController.findById);
// Update a datasourceSchema with id
router.put('/:id', datasourceSchemaController.update);
// Delete a datasourceSchema with id
router.delete('/:id', datasourceSchemaController.delete);
// reset a datasourceSchema by name
router.post('/:id/reset/', datasourceSchemaController.reset);

module.exports = router
