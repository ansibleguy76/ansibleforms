'use strict';
const Job = require('../models/job.model');
var RestResult = require('../models/restResult.model');

exports.findAll = function(req, res) {
    Job.findAll(function(err, job) {
        if (err){
          res.json(new RestResult("error","failed to find jobs",null,err))
        }else{
          res.json(new RestResult("success","jobs found",job,""));
        }
    });
};
exports.findById = function(req, res) {
    Job.findById(req.params.id, function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to find job",null,err))
        }else{
            if(job.length>0){
              res.json(new RestResult("success","found job",job,""));
            }else{
              res.json(new RestResult("error","failed to find job",null,err))
            }

        }
    });
};
exports.delete = function(req, res) {
    Job.delete( req.params.id, function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to delete job",null,err))
        }else{
            res.json(new RestResult("success","job deleted",null,""));
        }

    });
};
