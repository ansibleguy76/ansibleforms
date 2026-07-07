'use strict';
import Group from '../../models/group.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';

const find = async function(req, res) {
  try {
    if(req.query.name){
      const group = await Group.findByName(req.query.name);
      if(group){
        res.json(RestResult.single(group));
      }else{
        res.status(404).json(RestResult.error(i18n.t(req, 'resources.groupNotFound')));
      }
    }else{
      const groups = await Group.findAll();
      res.json(RestResult.list(groups));
    }
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindGroup'), err.toString()));
  }
};

const create = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error(i18n.t(req, 'errors.requiredFields')));
    }else{
      try {
        const group = await Group.create(req.body);
        res.json(RestResult.single(group));
      } catch(err) {
        res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedCreateGroup'), err.toString()));
      }
    }
};

const findById = async function(req, res) {
  try {
    const group = await Group.findById(req.params.id);
    if(group){
      res.json(RestResult.single(group));
    }else{
      res.status(404).json(RestResult.error(i18n.t(req, 'resources.groupNotFound')));
    }
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindGroup'), err.toString()));
  }
};

const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error(i18n.t(req, 'errors.requiredFields')));
    }else{
      try {
        await Group.update(req.body, req.params.id);
        res.json(RestResult.single(null));
      } catch(err) {
        res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedUpdateGroup'), err.toString()));
      }
    }
};

const deleteGroup = async function(req, res) {
  try{
    await Group.delete(req.params.id);
    res.json(RestResult.single(null));
  }catch(err){
    if(err.message === "Group still has users"){
      res.status(400).json(RestResult.error(i18n.t(req, 'resources.groupHasUsers')));
    }else{
      res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedDeleteGroup'), err.toString()));
    }
  }
};

export default {
  find,
  create,
  findById,
  update,
  delete: deleteGroup
};