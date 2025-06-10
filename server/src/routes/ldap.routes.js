import express from 'express';
import ldapController from '../controllers/ldap.controller.js';

const router = express.Router();
// Retrieve ldap
router.get('/', ldapController.find);
// Set ldap
router.put('/', ldapController.update);
// Test ldap
router.post('/check/', ldapController.check);

export default router
