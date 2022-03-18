'use strict';
const Repo = require('../models/repo.model');
var RestResult = require('../models/restResult.model');


exports.find = function(req, res) {
  if(req.query.name){
    Repo.findByName(req.query.name,(req.query.text=="true"),function(err, repo) {
        if (err){
          res.json(new RestResult("error",err,null,err))
        }else{
          res.json(new RestResult("success","repository found",repo,""));
        }
    });
  }else{
    Repo.findAll(function(err, repos) {
        if (err){
          res.json(new RestResult("error","failed to find repositories",null,err))
        }else{
          res.json(new RestResult("success","repositories found",repos,""));
        }
    });
  }

};
exports.create = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Repo.create(req.body.uri,req.body.command, function(err, output) {
            if (err){
              res.json(new RestResult("error","failed to create repository",null,err))
            }else{
              res.json(new RestResult("success","repository created",output,""));
            }
        });
    }
};
exports.delete = function(req, res) {
  if(req.query.name){
    Repo.delete( req.query.name,function(err, group) {
        if (err){
            res.json(new RestResult("error","failed to delete repository",null,err))
        }else{
            res.json(new RestResult("success","repository deleted",null,""));
        }
    });
  }else{
    res.json(new RestResult("error","no repository name specified",null,""));
  }
};
