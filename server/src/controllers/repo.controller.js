'use strict';
const Repo = require('../models/repo.model');
var RestResult = require('../models/restResult.model');


exports.find = function(req, res) {
  if(req.query.name){
    Repo.findByName(req.query.name,(req.query.text=="true"))
      .then((repo)=>{res.json(new RestResult("success","repository found",repo,""))})
      .catch((err)=>{res.json(new RestResult("error",err,null,err.toString()))})
  }else{
    Repo.findAll()
      .then((repos)=>{res.json(new RestResult("success","repositories found",repos,""))})
      .catch((err)=>{res.json(new RestResult("error","failed to find repositories",null,err.toString()))})
  }

};
exports.create = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Repo.create(req.body.uri,req.body.command)
          .then((output)=>{res.json(new RestResult("success","repository created",output,""))})
          .catch((err)=>{res.json(new RestResult("error","failed to create repository",null,err.toString()))})
    }
};
exports.addKnownHosts = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Repo.addKnownHosts(req.body.hosts)
          .then((output)=>{res.json(new RestResult("success","hosts added",output,""))})
          .catch((err)=>{res.json(new RestResult("error","failed to add hosts",null,err.toString()))})
    }
};
exports.delete = function(req, res) {
  if(req.query.name){
    Repo.delete( req.query.name)
      .then(()=>{res.json(new RestResult("success","repository deleted",null,""))})
      .catch((err)=>{res.json(new RestResult("error","failed to delete repository",null,err.toString()))})
  }else{
    res.json(new RestResult("error","no repository name specified",null,""));
  }
};

exports.pull = async function(req, res) {

    // get the form data
    var restResult = new RestResult("success","","","")
    var repositoryName = req.params.repositoryName
    if(!repositoryName){
      // wrong implementation -> send 400 error
      res.json(new RestResult("error","no repository","","name is a required field"));
    }else{
      Repo.pull(repositoryName)
      .then((out)=>{
        restResult.message = "succesfully pulled repository"
        restResult.data.output = out
        res.json(restResult);
      })
      .catch((err)=>{
        restResult.status = "error"
        restResult.message = `error occured pulling repository ${repositoryName}`
        restResult.data.error = err.toString()
        res.json(restResult);
      })
    }

};