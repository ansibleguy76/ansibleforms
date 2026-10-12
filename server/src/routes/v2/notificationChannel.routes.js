import express from 'express';
const router = express.Router();
import notificationChannelController from '../../controllers/v2/notificationChannel.controller.js';

router.get('/', notificationChannelController.find);
router.post('/', notificationChannelController.create);
router.get('/:id', notificationChannelController.findById);
router.put('/:id', notificationChannelController.update);
router.delete('/:id', notificationChannelController.delete);
// a test notification through the saved channel (a mail one : to the address given)
router.post('/:id/test', notificationChannelController.test);

export default router
