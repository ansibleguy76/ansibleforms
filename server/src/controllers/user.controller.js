'use strict';
import User from '../models/user.model.js';
import RestResult from '../models/restResult.model.js';

const findAllOr1 = function(req, res) {
  if(req.query.username){
    User.findByUsername(req.query.username)
    .then((user)=>{res.json(new RestResult("success","user found",user,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find user",null,err.toString()))})
  }else{
    User.findAll()
    .then((users)=>{res.json(new RestResult("success","users found",users,""));})
    .catch((err)=>{res.json(new RestResult("error","failed to find users",null,err.toString()))})
  }

};
const create = function(req, res) {
    const new_user = new User(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.create(new_user)
        .then((user)=>{res.json(new RestResult("success","user added",user,""))})
        .catch((err)=>{res.json(new RestResult("error","failed to create user",null,err.toString()))})
    }
};
const findById = function(req, res) {
    User.findById(req.params.id)
    .then((user)=>{
      if(user.length>0){
        res.json(new RestResult("success","found user",user[0],""));
      }else{
        res.json(new RestResult("error","failed to find user",null,err.toString()))
      }
    })
    .catch((err)=>{res.json(new RestResult("error","failed to find user",null,err.toString()))})
};
const findByToken = function(req, res) {
    User.findById(req.user.user.username)
    .then((user)=>{
      if(user.length>0){
        res.json(new RestResult("success","found user",user[0].id,""));
      }else{
        res.json(new RestResult("error","failed to find user",null,err.toString()))
      }
    })
    .catch((err)=>{res.json(new RestResult("error","failed to find user",null,err.toString()))})
};
const update = function(req, res) {
    // don't tamper with username
    delete req.body.username
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.update(new User(req.body),req.params.id)
        .then(()=>{res.json(new RestResult("success","user updated",null,""))})
        .catch((err)=>{res.json(new RestResult("error","failed to update user",null,err.toString()))})
    }
};
const changePassword = function(req, res) {
  if(req.user.user.type=="local" && req.user.user.id){
    // make sure then don't tamper with the group or username
    delete req.body.group_id
    delete req.body.username
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.update(new User(req.body),req.user.user.id)
        .then((user)=>{res.json(new RestResult("success","password changed",null,""))})
        .catch((err)=>{res.json(new RestResult("error","failed to change password",null,err.toString()))})
    }
  }else{
    res.json(new RestResult("error","you can't change the password for an ldap user",null,err.toString()))
  }
};
const find = function(req, res) {
    res.json(new RestResult("success","found user",req.user.user,""));
};
const deleteUser = function(req, res) {
    User.delete( req.params.id)
    .then(()=>{res.json(new RestResult("success","user deleted",null,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to delete user",null,err.toString()))})
};

export default {
  findAllOr1,
  create,
  findById,
  findByToken,
  update,
  changePassword,
  find,
  delete: deleteUser
};