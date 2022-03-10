'use strict';
const Log = require('../models/log.model');

exports.get = function(req, res) {
    Log.find(req.query.lines||100,function(err, log) {
        if (err){
            res.send('...')
        }else{
            res.send(log)
        }
    });
};
