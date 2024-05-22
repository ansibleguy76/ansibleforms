'use strict';
const Log = require('../models/log.model');

exports.get = function(req, res) {
    Log.find(req.query.lines||100)
      .then((log)=>{res.send(log)})
      .catch((err)=>{res.send("...")})
};

exports.download = function(req,res){
    try{
        var file = Log.getFileName()
        res.download(file)
    }catch(err){
        // return 404
        res.status(404).send(err.toString())
    }
}