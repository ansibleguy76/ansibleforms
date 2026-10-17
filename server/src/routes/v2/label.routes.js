import express from 'express';
const router = express.Router();
import labelController from '../../controllers/v2/label.controller.js';

// Settings > Appearance > Labels
router.get('/', labelController.find);
router.post('/', labelController.create);
router.get('/:id', labelController.findById);
router.put('/:id', labelController.update);
router.delete('/:id', labelController.delete);
// one place up or down in the header
router.post('/:id/move', labelController.move);

export default router
