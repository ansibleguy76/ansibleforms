'use strict';
const Group = require('../models/group.model');
var RestResult = require('../models/restResult.model');

exports.findAll = function(req, res) {
    Group.findAll(function(err, group) {
        if (err){
          res.json(new RestResult("error","failed to find groups",null,err))
        }else{
          res.json(new RestResult("success","groups found",group,""));
        }
    });
};
exports.create = function(req, res) {
    const new_group = new Group(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Group.create(new_group, function(err, group) {
            if (err){
              res.json(new RestResult("error","failed to create group",null,err))
            }else{
              res.json(new RestResult("success","group added",group,""));
            }
        });
    }
};
exports.findById = function(req, res) {
    Group.findById(req.params.id, function(err, group) {
        if (err){
            res.json(new RestResult("error","failed to find group",null,err))
        }else{
            if(group.length>0){
              res.json(new RestResult("success","found group",group[0],""));
            }else{
              res.json(new RestResult("error","failed to find group",null,err))
            }

        }
    });
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Group.update(new Group(req.body),req.params.id, function(err, group) {
            if (err){
                res.json(new RestResult("error","failed to update group",null,err))
            }else{
                res.json(new RestResult("success","group updated",null,""));
            }
        });
    }
};
exports.delete = function(req, res) {
    Group.delete( req.params.id,function(err, group) {
        if (err){
            res.json(new RestResult("error","failed to delete group",null,err))
        }else{
            res.json(new RestResult("success","group deleted",null,""));
        }

    });
};
