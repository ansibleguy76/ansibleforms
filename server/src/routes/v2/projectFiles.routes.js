import express from 'express';
const router = express.Router();
import projectFilesController from '../../controllers/v2/projectFiles.controller.js';
import Middleware from '../../lib/middleware.js';

// the workflows' names (a workflow form's workflow), before /:kind/... takes the path
router.get('/workflows/names', projectFilesController.workflowNames);
// the designer's playbooks, vars files, inventories and workflows : :kind is one of them ; each
// kind written only with its own role option (allowPlaybookDesign, allowWorkflowDesign, ...)
router.get('/:kind', projectFilesController.list);
router.get('/:kind/file', projectFilesController.read);
router.put('/:kind/file', Middleware.checkFileDesignMiddleware, projectFilesController.save);
router.post('/:kind/file', Middleware.checkFileDesignMiddleware, projectFilesController.create);
router.delete('/:kind/file', Middleware.checkFileDesignMiddleware, projectFilesController.remove);
// commit and push the kind's repository
router.post('/:kind/push', Middleware.checkFileDesignMiddleware, projectFilesController.push);

export default router
