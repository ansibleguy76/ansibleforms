'use strict';
import User from '../../models/user.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import Errors from '../../lib/errors.js';

const findAllOr1 = async function(req, res) {
  try {
    if(req.query.username){
      const user = await User.findByUsername(req.query.username);
      // Mask password before returning to API
      if (user && user.password) {
        user.password = '**********';
      }
      res.json(RestResult.single(user));
    }else{
      const users = await User.findAll();
      // Mask passwords before returning to API
      users.forEach(u => {
        if (u.password) u.password = '**********';
      });
      res.json(RestResult.list(users));
    }
  } catch(err) {
    res.status(500).json(RestResult.error(err.toString()));
  }
};

const create = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
        try {
          const user = await User.create(req.body);
          res.json(RestResult.single(user));
        } catch(err) {
          res.status(500).json(RestResult.error(err.toString()));
        }
    }
};

const findById = async function(req, res) {
    try {
      const user = await User.findById(req.params.id);
      // Mask password before returning to API
      if (user && user.password) {
        user.password = '**********';
      }
      res.json(RestResult.single(user));
    } catch(err) {
      if (err instanceof Errors.NotFoundError) {
        res.status(404).json(RestResult.error('User not found'));
      } else {
        res.status(500).json(RestResult.error(err.toString()));
      }
    }
};

const findByToken = async function(req, res) {
    try {
      const user = await User.findByUsername(req.user.user.username);
      if(user){
        res.json(RestResult.single(user.id));
      }else{
        res.status(404).json(RestResult.error('User not found'));
      }
    } catch(err) {
      res.status(500).json(RestResult.error(err.toString()));
    }
};

const update = async function(req, res) {
    // don't tamper with username
    delete req.body.username
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
        try {
          await User.update(req.body,req.params.id);
          res.json(RestResult.single(null));
        } catch(err) {
          res.status(500).json(RestResult.error(err.toString()));
        }
    }
};

const changePassword = async function(req, res) {
  if(req.user.user.type=="local" && req.user.user.id){
    // make sure then don't tamper with the group or username
    delete req.body.group_id
    delete req.body.username
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
        try {
          await User.update(req.body,req.user.user.id);
          res.json(RestResult.single(null));
        } catch(err) {
          res.status(500).json(RestResult.error(err.toString()));
        }
    }
  }else{
    res.status(400).json(RestResult.error("you can't change the password for an ldap user"));
  }
};

const find = function(req, res) {
    res.json(RestResult.single(req.user.user));
};

const deleteUser = async function(req, res) {
    try {
      await User.delete(req.params.id);
      res.json(RestResult.single(null));
    } catch(err) {
      res.status(500).json(RestResult.error(err.toString()));
    }
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