'use strict';
import express from 'express';
import oauth2Controller from '../controllers/oauth2.controller.js';
const router = express.Router();

// Retrieve all OAuth2 providers
router.get('/', oauth2Controller.find);
// Create a new OAuth2 provider
router.post('/', oauth2Controller.create);
// Retrieve a single OAuth2 provider with id
router.get('/:id', oauth2Controller.findById);
// Update an OAuth2 provider with id
router.put('/:id', oauth2Controller.update);
// Delete an OAuth2 provider with id
router.delete('/:id', oauth2Controller.delete);

export default router;
