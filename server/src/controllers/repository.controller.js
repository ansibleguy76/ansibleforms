'use strict';
import Repository from '../models/repository.model.js';
import RestResult from '../models/restResult.model.js';


const find = function(req, res) {
    Repository.findAll()
    .then((repositories)=>{res.json(new RestResult("success","repositories found",repositories,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find repositories",null,err.toString()))})
};
const create = function(req, res) {
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
const findByName = function(req, res) {
    Repository.findByName(req.params.name)
    .then((repository)=>{
      repository.password = "********"; // mask the password for api
      res.json(new RestResult("success","found repository",repository,""));
    })
    .catch((err)=>{ res.json(new RestResult("error","failed to find repository",null,err.toString())) })
};
const update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Repository.update(new Repository(req.body),req.params.name)
        .then((repository)=>{res.json(new RestResult("success","repository updated",null,""))})
        .catch((err)=>{ res.json(new RestResult("error","failed to update repository",null,err.toString())) })
    }
};
const deleteRepository = function(req, res) {
    Repository.delete(req.params.name)
    .then(()=>{res.json(new RestResult("success","repository deleted",null,""))})
    .catch((err)=>{ res.json(new RestResult("error","failed to delete repository",null,err.toString())) })
};
const clone = function(req, res) {
  Repository.clone(req.params.name)
  .then(()=>{res.json(new RestResult("success","repository cloned",null,""))})
  .catch((err)=>{ res.json(new RestResult("error","failed to clone repository",null,err.toString())) })
};
const reset = function(req, res) {
    Repository.reset(req.params.name)
    .then(()=>{res.json(new RestResult("success","repository reset",null,""))})
    .catch((err)=>{ res.json(new RestResult("error","failed to reset repository",null,err.toString())) })
};
const pull = function(req, res) {
  Repository.pull(req.params.name)
  .then(()=>{res.json(new RestResult("success","repository pulled",null,""))})
  .catch((err)=>{ res.json(new RestResult("error","failed to pull repository",null,err.toString())) })
};

export default {
    find,
    create,
    findByName,
    update,
    "delete": deleteRepository,
    clone,
    reset,
    pull
};