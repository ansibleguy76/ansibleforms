import express from 'express';
const router = express.Router();
import healthController from '../../controllers/v2/health.controller.js';

// The mount already applies authobj + checkSettingsMiddleware (see app.js) : the
// snapshot names the designer-lock holder, the config source and the repository
// state, which is settings-level information. Deliberately reusing showSettings
// rather than adding a 17th role option for one page.
router.get('/', healthController.check);

export default router;
