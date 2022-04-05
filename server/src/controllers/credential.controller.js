'use strict';
const Credential = require('../models/credential.model');
var RestResult = require('../models/restResult.model');

exports.find = function(req, res) {
  if(req.query.name){
    Credential.findByName2(req.query.name)
    .then((credential)=>{res.json(new RestResult("success","credentials found",credential,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find credentials",null,err))})
  }else{
    Credential.findAll()
    .then((credentials)=>{res.json(new RestResult("success","credentials found",credentials,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find credentials",null,err))})
  }
};
exports.create = function(req, res) {
    const new_credential = new Credential(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.create(new_credential)
        .then((credential)=>{ res.json(new RestResult("success","credential added",credential,"")) })
        .catch((err)=>{ res.json(new RestResult("error","failed to create credential",null,err)) })
    }
};
exports.findById = function(req, res) {
    Credential.findById(req.params.id)
    .then((credential)=>{
      if(credential.length>0){
        res.json(new RestResult("success","found credential",credential[0],""));
      }else{
        res.json(new RestResult("error","failed to find credential",null,err))
      }
    })
    .catch((err)=>{res.json(new RestResult("error","failed to find credential",null,err))})
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.update(new Credential(req.body),req.params.id)
        .then((credential)=>{res.json(new RestResult("success","credential updated",null,""))})
        .catch((err)=>{res.json(new RestResult("error","failed to update credential",null,err))})
    }
};
exports.delete = function(req, res) {
    Credential.delete(req.params.id)
    .then(()=>{res.json(new RestResult("success","credential deleted",null,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to delete credential",null,err))})
};
