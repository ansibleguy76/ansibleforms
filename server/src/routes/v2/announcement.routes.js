import express from 'express';
const router = express.Router();
import announcementController from '../../controllers/v2/announcement.controller.js';

// Settings > Appearance > Announcements
router.get('/', announcementController.find);
router.post('/', announcementController.create);
router.get('/:id', announcementController.findById);
router.put('/:id', announcementController.update);
router.delete('/:id', announcementController.delete);

export default router
