import express from 'express';
const router = express.Router();
import directoryController from '../../controllers/v2/directory.controller.js';
import apiTokenController from '../../controllers/v2/apiToken.controller.js';

// the LDAP and SSO users and groups (settings only : app.js) ; a name is url-encoded
router.get('/users/:type/:name', directoryController.findUser);
// block (body { blocked: true }) or allow its sign-in
router.post('/users/:type/:name/block', directoryController.setBlocked);
router.post('/users/:type/:name/end-sessions', directoryController.endUserSessions);
// its api tokens : listed, one revoked (#1068)
router.get('/users/:type/:name/tokens', apiTokenController.findForUser);
router.delete('/users/:type/:name/tokens/:sid', apiTokenController.revokeForUser);
// forget its record (back at its next sign-in)
router.delete('/users/:type/:name', directoryController.forgetUser);
router.get('/groups/:type/:name', directoryController.findGroup);

export default router;
