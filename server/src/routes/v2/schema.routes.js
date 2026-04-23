import express from 'express';
import schemaController from '../../controllers/v2/schema.controller.js';

const router = express.Router();

// check the database schema
router.get('/', schemaController.hasSchema);
// create the database schema
router.post('/', schemaController.create);

export default router
