import Health from '../../models/health.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';
import helpers from '../../lib/common.js';

// GET /api/v2/health : a read-only snapshot of the instance. Health.check never
// throws for an individual failing dependency (it reports that check as an error
// instead), so a 500 here means the check machinery itself broke.
const check = async function (req, res) {
  try {
    const result = await Health.check();
    res.json(RestResult.single(result));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'health.failedCheck'), helpers.getError(err)));
  }
};

export default { check };
