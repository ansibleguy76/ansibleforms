'use strict';
import User from '../../models/user.model.js';
import RestResult from '../../models/restResult.model.js';
import Errors from '../../lib/errors.js';
import Audit from '../../models/audit.model.js';

const findAllOr1 = function(req, res) {
  if(req.query.username){
    User.findByUsername(req.query.username)
    .then((user)=>{
      // Mask password before returning to API
      if (user && user.password) {
        user.password = '**********';
      }
      res.json(new RestResult("success","user found",user,""))
    })
    .catch((err)=>{res.json(new RestResult("error","failed to find user",null,err.toString()))})
  }else{
    User.findAll()
    .then((users)=>{
      // Mask passwords before returning to API
      users.forEach(u => {
        if (u.password) u.password = '**********';
      });
      res.json(new RestResult("success","users found",users,""));
    })
    .catch((err)=>{res.json(new RestResult("error","failed to find users",null,err.toString()))})
  }

};
const create = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        User.create(req.body)
        .then((user)=>{res.json(new RestResult("success","user added",user,""))})
        .catch((err)=>{res.json(new RestResult("error","failed to create user",null,err.toString()))})
    }
};
const findById = function(req, res) {
    User.findById(req.params.id)
    .then((user)=>{
      // Mask password before returning to API
      if (user && user.password) {
        user.password = '**********';
      }
      res.json(new RestResult("success","found user",user,""));
    })
    .catch((err)=>{
      if (err instanceof Errors.NotFoundError) {
        res.json(new RestResult("error","failed to find user",null,"User not found"));
      } else {
        res.json(new RestResult("error","failed to find user",null,err.toString()));
      }
    })
};
const findByToken = function(req, res) {
    User.findByUsername(req.user.user.username)
    .then((user)=>{
      if(user){
        res.json(new RestResult("success","found user",user.id,""));
      }else{
        res.json(new RestResult("error","failed to find user",null,"User not found"))
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
        User.update(req.body,req.params.id)
        .then(()=>{res.json(new RestResult("success","user updated",null,""))})
        .catch((err)=>{res.json(new RestResult("error","failed to update user",null,err.toString()))})
    }
};
// Same rules as the v2 controller. Enforcing them in only one version is not enforcing
// them: this route is reachable with the same token, and it had neither the `id` strip
// nor the current-password check, so a stolen session could be turned into permanent
// ownership of the account through the older URL.
const changePassword = async function(req, res) {
  if(req.user.user.type=="local" && req.user.user.id){
    // make sure then don't tamper with the group or username
    delete req.body.group_id
    delete req.body.username
    // ...nor with which ROW this writes to : `id` is a writable field in crud.config
    delete req.body.id
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        return res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }
    try {
      // Only when a password is actually being set, so updating an email still works.
      if (req.body.password) {
        const current = req.body.currentPassword;
        if (!current) {
          return res.status(400).json(new RestResult("error","the current password is required",null,""));
        }
        // User.authenticate RESOLVES with { isValid: false } for a wrong password - it
        // does not reject - so the result has to be inspected, not merely awaited.
        let check = null;
        try {
          check = await User.authenticate(req.user.user.username, current);
        } catch (e) {
          check = null;
        }
        if (!check?.isValid) {
          Audit.log({
            user: req.user?.user, ip: req.ip, action: 'user.password.update',
            outcome: 'denied', targetType: 'user', target: req.user.user.username,
            detail: { reason: 'current password did not match' },
          });
          // 403, never 401 : a 401 makes the client's axios interceptor drop the session
          return res.status(403).json(new RestResult("error","the current password is not correct",null,""));
        }
      }
      delete req.body.currentPassword
      await User.update(req.body,req.user.user.id)
      res.json(new RestResult("success","password changed",null,""))
    } catch(err) {
      res.status(500).json(new RestResult("error","failed to change password",null,err.toString()))
    }
  }else{
    res.json(new RestResult("error","you can't change the password for an ldap user",null,""))
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