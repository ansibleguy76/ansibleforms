'use strict';
const Repository = require('../models/repository.model');
var RestResult = require('../models/restResult.model');
const mysql=require("../lib/mysql")
const postgres=require("../lib/postgres")
const mssql=require("../lib/mssql")

exports.find = function(req, res) {
    Repository.findAll()
    .then((repositories)=>{res.json(new RestResult("success","repositories found",repositories,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find repositories",null,err.toString()))})
};
exports.create = function(req, res) {
    const new_repository = new Repository(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Repository.create(new_repository)
        .then((repository)=>{ res.json(new RestResult("success","repository added",repository,"")) })
        .catch((err)=>{ res.json(new RestResult("error","failed to create repository",null,err.toString())) })
    }
};
exports.findByName = function(req, res) {
    Repository.findByName(req.params.name)
    .then((repository)=>{
      res.json(new RestResult("success","found repository",repository,""));
    })
    .catch((err)=>{ res.json(new RestResult("error","failed to find repository",null,err.toString())) })
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Repository.update(new Repository(req.body),req.params.name)
        .then((repository)=>{res.json(new RestResult("success","repository updated",null,""))})
        .catch((err)=>{ res.json(new RestResult("error","failed to update repository",null,err.toString())) })
    }
};
exports.delete = function(req, res) {
    Repository.delete(req.params.name)
    .then(()=>{res.json(new RestResult("success","repository deleted",null,""))})
    .catch((err)=>{ res.json(new RestResult("error","failed to delete repository",null,err.toString())) })
};
exports.clone = function(req, res) {
  Repository.clone(req.params.name)
  .then(()=>{res.json(new RestResult("success","repository cloned",null,""))})
  .catch((err)=>{ res.json(new RestResult("error","failed to clone repository",null,err.toString())) })
};
exports.reset = function(req, res) {
    Repository.reset(req.params.name)
    .then(()=>{res.json(new RestResult("success","repository reset",null,""))})
    .catch((err)=>{ res.json(new RestResult("error","failed to reset repository",null,err.toString())) })
};
exports.pull = function(req, res) {
  Repository.pull(req.params.name)
  .then(()=>{res.json(new RestResult("success","repository pulled",null,""))})
  .catch((err)=>{ res.json(new RestResult("error","failed to pull repository",null,err.toString())) })
};

