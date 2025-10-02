import express from 'express';
import credentialController from '../controllers/credential.controller.v2.js';
const router = express.Router();

// Retrieve all credentials
router.get('/', credentialController.find);
// Create a new credential
router.post('/', credentialController.create);
// Retrieve a single credential with id
router.get('/:id', credentialController.findById);
// Update a credential with id
router.put('/:id', credentialController.update);
// Delete a credential with id
router.delete('/:id', credentialController.delete);

router.get('/testdb/:id', credentialController.testDb)

export default router
