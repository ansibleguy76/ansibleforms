import Audit from '../../models/audit.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';
import helpers from '../../lib/common.js';

// Read only by design : there is deliberately no create, update or delete handler
// here. Entries are written by Audit.log from the middleware and the models, and
// removed only by the retention sweep.
const findAll = async function (req, res) {
  try {
    const result = await Audit.find({
      actor: req.query.actor,
      action: req.query.action,
      targetType: req.query.targetType,
      target: req.query.target,
      outcome: req.query.outcome,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(RestResult.single(result));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'audit.failedGet'), helpers.getError(err)));
  }
};

const facets = async function (req, res) {
  try {
    res.json(RestResult.single(await Audit.facets()));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'audit.failedGet'), helpers.getError(err)));
  }
};

export default { findAll, facets };
