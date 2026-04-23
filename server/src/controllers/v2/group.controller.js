'use strict';
import Group from '../../models/group.model.js';
import RestResult from '../../models/restResult.model.v2.js';

const find = async function(req, res) {
  try {
    if(req.query.name){
      const group = await Group.findByName(req.query.name);
      if(group){
        res.json(RestResult.single(group));
      }else{
        res.status(404).json(RestResult.error("No such group found"));
      }
    }else{
      const groups = await Group.findAll();
      res.json(RestResult.list(groups));
    }
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to find group", err.toString()));
  }
};

const create = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
      try {
        const group = await Group.create(req.body);
        res.json(RestResult.single(group));
      } catch(err) {
        res.status(500).json(RestResult.error("Failed to create group", err.toString()));
      }
    }
};

const findById = async function(req, res) {
  try {
    const group = await Group.findById(req.params.id);
    if(group){
      res.json(RestResult.single(group));
    }else{
      res.status(404).json(RestResult.error("No such group found"));
    }
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to find group", err.toString()));
  }
};

const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
      try {
        await Group.update(req.body, req.params.id);
        res.json(RestResult.single(null));
      } catch(err) {
        res.status(500).json(RestResult.error("Failed to update group", err.toString()));
      }
    }
};

const deleteGroup = async function(req, res) {
  try{
    const deleted = await Group.delete(req.params.id);
    if(deleted.affectedRows==1){
      res.json(RestResult.single(null));
    }else{
      res.status(400).json(RestResult.error("Unknown group or group has users", `affected rows : ${deleted.affectedRows}`));
    }
  }catch(err){
    res.status(500).json(RestResult.error("Failed to delete group", err.toString()));
  }
};

export default {
  find,
  create,
  findById,
  update,
  delete: deleteGroup
};