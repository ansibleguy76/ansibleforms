import express from 'express';
import ldapDirectoryController from '../../controllers/v2/ldapDirectory.controller.js';

// Settings > Access > LDAP : the directories
const router = express.Router();
router.get('/', ldapDirectoryController.findAll);
router.post('/', ldapDirectoryController.create);
router.get('/:id', ldapDirectoryController.findById);
router.put('/:id', ldapDirectoryController.update);
router.delete('/:id', ldapDirectoryController.remove);
// one place up or down in the lookup order
router.post('/:id/move', ldapDirectoryController.move);
// a sign-in of a test user, with the page's fields as they are
router.post('/:id/check', ldapDirectoryController.check);

export default router
