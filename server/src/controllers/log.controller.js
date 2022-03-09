'use strict';
const Log = require('../models/log.model');

exports.get = function(req, res) {
    Log.find(function(err, log) {
        if (err){
            res.send('...')
        }else{
            res.send(log)
        }
    });
};
