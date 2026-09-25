import express from 'express';
const router = express.Router();
import configSeedController from '../../controllers/v2/configseed.controller.js';

// Settings admin only, mounted with checkSettingsMiddleware in app.js : applying the seed
// rewrites awx connections, credentials, oauth2 providers, repositories, ldap and the mail
// settings, which is the same reach as the pages that own them.
router.post('/apply', configSeedController.apply);

export default router;
