import express from 'express';
const router = express.Router();
import runnerController from '../../controllers/v2/runner.controller.js';

router.get('/', runnerController.find);
router.get('/types', runnerController.types);
// the join tokens RTEs add themselves with (Connections > Runners > Add runner)
router.get('/jointoken', runnerController.findJoinTokens);
router.post('/jointoken', runnerController.createJoinToken);
router.post('/jointoken/:id/revoke', runnerController.revokeJoinToken);
router.delete('/jointoken/:id', runnerController.deleteJoinToken);
router.post('/', runnerController.create);
router.get('/:id', runnerController.findById);
router.put('/:id', runnerController.update);
router.delete('/:id', runnerController.delete);
// read-only connection test
router.post('/:id/check', runnerController.check);

export default router
