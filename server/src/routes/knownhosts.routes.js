import express from 'express';
import knownhostsController from '../controllers/knownhosts.controller.js';

const router = express.Router();

// get 
router.get('/', knownhostsController.find);
// add
router.post('/', knownhostsController.add);
// remove
router.delete('/', knownhostsController.remove);

export default router
