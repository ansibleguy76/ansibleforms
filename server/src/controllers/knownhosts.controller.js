'use strict';
const KnownHosts = require('../models/knownhosts.model');
var RestResult = require('../models/restResult.model');


exports.find = function(req, res) {
    KnownHosts.findAll()
      .then((hosts)=>{res.json(new RestResult("success","Hosts found",hosts,""))})
      .catch((err)=>{res.json(new RestResult("error","failed to find Hosts",null,err.toString()))})
};
exports.add = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        KnownHosts.add(req.body.host)
          .then((output)=>{res.json(new RestResult("success","Host added",output,""))})
          .catch((err)=>{res.json(new RestResult("error","failed to add host",null,err.toString()))})
    }
};
exports.remove = function(req, res) {
  if(req.query.name){
    KnownHosts.remove( req.query.name)
      .then(()=>{res.json(new RestResult("success","Host removed",null,""))})
      .catch((err)=>{res.json(new RestResult("error","failed to remove host",null,err.toString()))})
  }else{
    res.json(new RestResult("error","no host name specified",null,""));
  }
};
