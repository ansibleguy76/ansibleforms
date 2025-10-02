import express from 'express';
const router = express.Router();
import datasourceController from '../controllers/datasource.controller.js';
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

export default router
