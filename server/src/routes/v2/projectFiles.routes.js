import express from 'express';
const router = express.Router();
import projectFilesController from '../../controllers/v2/projectFiles.controller.js';

// the designer's playbooks and vars files : :kind is 'playbooks' or 'vars'
router.get('/:kind', projectFilesController.list);
router.get('/:kind/file', projectFilesController.read);
router.put('/:kind/file', projectFilesController.save);
router.post('/:kind/file', projectFilesController.create);
router.delete('/:kind/file', projectFilesController.remove);
// commit and push the kind's repository
router.post('/:kind/push', projectFilesController.push);

export default router
