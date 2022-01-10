'use strict';
var RestResult = require('../models/restResult.model');
const version = require('../../package.json').version
exports.get = function(req, res) {
    res.json(new RestResult("success",version));
};
