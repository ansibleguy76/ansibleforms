'use strict';
// Re-apply the declarative config seed on demand.
//
// The poll in cron.service already picks up a changed file on its own, so this exists for
// the two cases the poll cannot serve : a deployment hook that wants the seed in force
// BEFORE it reports success rather than up to a minute later, and an operator who has just
// fixed a broken file and would rather not wait to find out whether it took.
//
// It forces, deliberately. "Nothing changed on disk" is exactly the situation somebody
// wants to re-assert from here - a managed record edited straight in the database, or a
// repository whose working tree went missing - and the apply is idempotent, so forcing
// costs a comparison per declared object and writes nothing when they all match.
import RestResult from '../../models/restResult.model.v2.js';
import { reloadConfigSeed } from '../../lib/seed.js';
import logger from '../../lib/logger.js';
import i18n from '../../lib/i18n.js';

const configSeedController = {
  async apply(req, res) {
    try {
      const result = await reloadConfigSeed({ force: true, trigger: `api:${req.user?.user?.username || 'unknown'}` });

      if (result.status === 'off') {
        return res.status(400).json(RestResult.error(i18n.t(req, 'resources.noConfigSeed'), null));
      }
      // A failed apply answers 500 with the reason. The instance is fine - it kept the
      // configuration it already had - but the request did not do what it asked for, and a
      // CD hook that reads only the status code has to be able to tell.
      if (result.status === 'failed') {
        return res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedApplyConfigSeed'), result.error));
      }

      // Names only, never values : the summary lists what was created, updated, released,
      // pruned and adopted, and most of what the seed carries is a secret.
      return res.json(RestResult.single({ status: result.status, summary: result.summary || null }));
    } catch (err) {
      // reloadConfigSeed catches everything the apply can throw, so reaching here means a
      // fault in this handler rather than in the seed. Answer, and say which it was.
      logger.error('Config seed apply endpoint failed : ' + (err.message || err));
      return res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedApplyConfigSeed'), err.message || String(err)));
    }
  },
};

export default configSeedController;
