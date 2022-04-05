'use strict';
const Log = require('../models/log.model');

exports.get = function(req, res) {
    Log.find(req.query.lines||100)
      .then((log)=>{res.send(log)})
      .catch((err)=>{res.send("...")})
};
