'use strict';
const Group = require('../models/group.model');
var RestResult = require('../models/restResult.model');

exports.find = function(req, res) {
  if(req.query.name){
    Group.findByName(req.query.name)
      .then((groups)=>{
        if(groups.length>0){
          res.json(new RestResult("success","found group",groups[0],""));
        }else{
          res.json(new RestResult("error","no such group found",null))
        }
      })
      .catch((err)=>{res.json(new RestResult("error","failed to find group",null,err.toString()))})
  }else{
    Group.findAll()
      .then((groups)=>{ res.json(new RestResult("success","groups found",groups,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to find groups",null,err.toString())) })
  }

};
exports.create = function(req, res) {
    const new_group = new Group(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Group.create(new_group)
          .then((group)=>{ res.json(new RestResult("success","group added",group,"")) })
          .catch((err)=>{ res.json(new RestResult("error","failed to create group",null,err.toString())) })
    }
};
exports.findById = function(req, res) {
    Group.findById(req.params.id)
      .then((groups)=>{
        if(groups.length>0){
          res.json(new RestResult("success","found group",groups[0],""));
        }else{
          res.json(new RestResult("error","no such group found",null))
        }
      })
      .catch((err)=>{res.json(new RestResult("error","failed to find group",null,err))})
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Group.update(new Group(req.body),req.params.id)
          .then(()=>{res.json(new RestResult("success","group updated",null,""))})
          .catch((err)=>{res.json(new RestResult("error","failed to update group",null,err.toString()))})
    }
};
exports.delete = function(req, res) {
    Group.delete( req.params.id)
      .then((deleted)=>{
        if(deleted.affectedRows==1){
          res.json(new RestResult("success","group deleted",null,""))
        }else{
          res.json(new RestResult("error","unknown group or group has users",null,`affected rows : ${deleted.affectedRows}`))
        }

      })
      .catch((err)=>{res.json(new RestResult("error","failed to delete group",null,err.toString()))})
};
