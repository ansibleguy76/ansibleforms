import express from 'express';
const router = express.Router();
import projectFilesController from '../../controllers/v2/projectFiles.controller.js';

// the workflows' names (a workflow form's workflow), before /:kind/... takes the path
router.get('/workflows/names', projectFilesController.workflowNames);
// the designer's playbooks, vars files, inventories and workflows : :kind is one of them
router.get('/:kind', projectFilesController.list);
router.get('/:kind/file', projectFilesController.read);
router.put('/:kind/file', projectFilesController.save);
router.post('/:kind/file', projectFilesController.create);
router.delete('/:kind/file', projectFilesController.remove);
// commit and push the kind's repository
router.post('/:kind/push', projectFilesController.push);

export default router
