import express from 'express';
import repositoryController from '../../controllers/v2/repository.controller.js';

const router = express.Router();

// designer-facing routes for the forms repositories (issue #414) ; they expose
// no credentials and are guarded by the designer middleware, so a designer
// user can push without settings access

// list the forms repositories
router.get('/', repositoryController.formsRepos);
// commit & push all forms repositories
router.post('/sync/', repositoryController.formsRepoSyncAll);
// commit & push one forms repository by name
router.post('/sync/:name', repositoryController.formsRepoSync);
// pull all forms repositories from their remote
router.post('/pull/', repositoryController.formsRepoPullAll);
// pull one forms repository from its remote by name
router.post('/pull/:name', repositoryController.formsRepoPull);

export default router
