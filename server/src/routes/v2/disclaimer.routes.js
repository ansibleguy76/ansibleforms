import express from 'express';
import disclaimerController from '../../controllers/v2/disclaimer.controller.js';

// every signed-in user : the disclaimer, accepted or declined
const router = express.Router();
router.get('/', disclaimerController.current);
router.post('/accept', disclaimerController.accept);
router.post('/decline', disclaimerController.decline);

// Settings > Access > Disclaimer : its text, on or off
export const disclaimerSettingsRouter = express.Router();
disclaimerSettingsRouter.get('/', disclaimerController.settings);
disclaimerSettingsRouter.put('/', disclaimerController.saveSettings);

// Settings > Access > Disclaimer > Versions : each text as it was agreed to
export const disclaimerVersionRouter = express.Router();
disclaimerVersionRouter.get('/', disclaimerController.versions);
disclaimerVersionRouter.get('/:id', disclaimerController.version);

// Settings > Access > Disclaimer > Acceptances : who accepted which version
export const disclaimerAcceptanceRouter = express.Router();
disclaimerAcceptanceRouter.get('/', disclaimerController.acceptances);
disclaimerAcceptanceRouter.get('/:id', disclaimerController.acceptance);

export default router
