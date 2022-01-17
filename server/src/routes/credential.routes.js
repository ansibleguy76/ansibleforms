const express = require('express')
const router = express.Router()
const credentialController =   require('../controllers/credential.controller');
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

module.exports = router
