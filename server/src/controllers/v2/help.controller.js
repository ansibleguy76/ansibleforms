'use strict';
import RestResult from '../../models/restResult.model.v2.js';
import Help from '../../models/help.model.js';
import i18n from '../../lib/i18n.js';

const get = async function(req, res) {
    try {
        const help = await Help.get();
        res.json(RestResult.single(help));
    } catch (err) {
        res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedLoadHelp'), err.toString()));
    }
};

export default {
  get
};