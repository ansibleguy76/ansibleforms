'use strict';
const User = require('../models/user.model');
var RestResult = require('../models/restResult.model');

exports.findAll = function(req, res) {
    User.findAll(function(err, user) {
        if (err){
          res.json(new RestResult("error","failed to find users",null,err))
        }else{
          res.json(new RestResult("success","users found",user,""));
        }
    });
};
exports.create = function(req, res) {
    const new_user = new User(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.create(new_user,function(err, user) {
            if (err){
              res.json(new RestResult("error","failed to create user",null,err))
            }else{
              res.json(new RestResult("success","user added",user,""));
            }
        });
    }
};
exports.findById = function(req, res) {
    User.findById(req.params.id, function(err, user) {
        if (err){
            res.json(new RestResult("error","failed to find user",null,err))
        }else{
            if(user.length>0){
              res.json(new RestResult("success","found user",user[0],""));
            }else{
              res.json(new RestResult("error","failed to find user",null,err))
            }

        }
    });
};
exports.find = function(req, res) {
    res.json(new RestResult("success","found user",req.user.user,""));
};
exports.findByToken = function(req, res) {
    User.findById(req.user.user.username, function(err, user) {
        if (err){
            res.json(new RestResult("error","failed to find user",null,err))
        }else{
          if(user.length>0){
            res.json(new RestResult("success","found user",user[0].id,""));
          }else{
            res.json(new RestResult("error","failed to find user",null,err))
          }
        }
    });
};
exports.update = function(req, res) {
    // don't tamper with username
    delete req.body.username
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.update(new User(req.body),req.params.id, function(err, user) {
            if (err){
                res.json(new RestResult("error","failed to update user",null,err))
            }else{
                res.json(new RestResult("success","user updated",null,""));
            }
        });
    }
};
exports.changePassword = function(req, res) {
  if(req.user.user.type=="local" && req.user.user.id){
    // make sure then don't tamper with the group or username
    delete req.body.group_id
    delete req.body.username
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.update(new User(req.body),req.user.user.id, function(err, user) {
            if (err){
                res.json(new RestResult("error","failed to change password",null,err))
            }else{
                res.json(new RestResult("success","password changed",null,""));
            }
        });
    }
  }else{
    res.json(new RestResult("error","you can't change the password for an ldap user",null,err))
  }
};
exports.delete = function(req, res) {
    User.delete( req.params.id, function(err, user) {
        if (err){
            res.json(new RestResult("error","failed to delete user",null,err))
        }else{
            res.json(new RestResult("success","user deleted",null,""));
        }

    });
};
