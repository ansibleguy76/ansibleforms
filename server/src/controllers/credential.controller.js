'use strict';
const Credential = require('../models/credential.model');
var RestResult = require('../models/restResult.model');

exports.find = function(req, res) {
  if(req.query.name){
    Credential.findByName2(req.query.name,function(err, credential) {
        if (err){
          res.json(new RestResult("error","failed to find credentials",null,err))
        }else{
          res.json(new RestResult("success","credentials found",credential,""));
        }
    });
  }else{
    Credential.findAll(function(err, credential) {
        if (err){
          res.json(new RestResult("error","failed to find credentials",null,err))
        }else{
          res.json(new RestResult("success","credentials found",credential,""));
        }
    });
  }

};
exports.create = function(req, res) {
    const new_credential = new Credential(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.create(new_credential, function(err, credential) {
            if (err){
              res.json(new RestResult("error","failed to create credential",null,err))
            }else{
              res.json(new RestResult("success","credential added",credential,""));
            }
        });
    }
};
exports.findById = function(req, res) {
    Credential.findById(req.params.id, function(err, credential) {
        if (err){
            res.json(new RestResult("error","failed to find credential",null,err))
        }else{
            if(credential.length>0){
              res.json(new RestResult("success","found credential",credential[0],""));
            }else{
              res.json(new RestResult("error","failed to find credential",null,err))
            }

        }
    });
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.update(new Credential(req.body),req.params.id, function(err, credential) {
            if (err){
                res.json(new RestResult("error","failed to update credential",null,err))
            }else{
                res.json(new RestResult("success","credential updated",null,""));
            }
        });
    }
};
exports.delete = function(req, res) {
    Credential.delete( req.params.id,function(err, credential) {
        if (err){
            res.json(new RestResult("error","failed to delete credential",null,err))
        }else{
            res.json(new RestResult("success","credential deleted",null,""));
        }

    });
};
