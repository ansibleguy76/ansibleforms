// Every error envelope in this file carries an HTTP STATUS.
//
// They all used to call res.json() with no status, so a failure answered 200 with an
// "error" body - a client checking the status code was told it had worked. That is how a
// failed create (the `description` column has no default) looked like a success, and how
// a refused edit of a seed-managed credential did too. 403 for the managed refusal, never
// 401: the client's global interceptor treats any 401 as a dead session.
'use strict';
import Credential from '../../models/credential.model.js';
import RestResult from '../../models/restResult.model.js';
import mysql from '../../lib/mysql.js';
import postgres from '../../lib/postgres.js';
import mssql from '../../lib/mssql.js';
import oracle from '../../lib/oracle.js';
import mongodb from '../../lib/mongodb.js';

const find = function(req, res) {
  if(req.query.name){
    Credential.findByName2(req.query.name)
    .then((credential)=>{
      // Mask password before returning to API
      if (credential && credential.password) {
        credential.password = '**********';
      }
      res.json(new RestResult("success","credentials found",credential,""))
    })
    .catch((err)=>{res.status(500).json(new RestResult("error","failed to find credentials",null,err.toString()))})
  }else{
    Credential.findAll()
    .then((credentials)=>{
      // Mask passwords before returning to API
      credentials.forEach(c => {
        if (c.password) c.password = '**********';
      });
      res.json(new RestResult("success","credentials found",credentials,""))
    })
    .catch((err)=>{res.status(500).json(new RestResult("error","failed to find credentials",null,err.toString()))})
  }
};
const create = function(req, res) {
    const new_credential = new Credential(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.create(new_credential)
        .then((credential)=>{ res.json(new RestResult("success","credential added",credential,"")) })
        .catch((err)=>{ res.status(500).json(new RestResult("error","failed to create credential",null,err.toString())) })
    }
};
const findById = function(req, res) {
    Credential.findById(req.params.id)
    .then((credential)=>{
      if(credential.length>0){
        // mask the password, by api we do not want to return the password
        credential[0].password = "********";
        res.json(new RestResult("success","found credential",credential[0],""));
      }else{
        res.status(404).json(new RestResult("error","failed to find credential",null,""))
      }
    })
    .catch((err)=>{ res.status(404).json(new RestResult("error","failed to find credential",null,err.toString())) })
};
const update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.update(new Credential(req.body),req.params.id)
        .then(()=>{res.json(new RestResult("success","credential updated",null,""))})
        .catch((err)=>{
            // a STATUS, not just an envelope : this answered HTTP 200 with an
            // "error" body, so a client checking the status code was told a
            // refused or failed update had worked. 403 for a seeded credential -
            // never 401, which would drop the session.
            const code = err?.name === 'AccessDeniedError' ? 403 : 500;
            res.status(code).json(new RestResult("error","failed to update credential",null,err.toString()))
        })
    }
};
const deleteCredential = function(req, res) {
    Credential.delete(req.params.id)
    .then(()=>{res.json(new RestResult("success","credential deleted",null,""))})
    .catch((err)=>{
        // a STATUS, not just an envelope : this answered HTTP 200 with an
        // "error" body, so a client checking the status code was told a
        // refused or failed delete had worked. 403 for a seeded credential -
        // never 401, which would drop the session.
        const code = err?.name === 'AccessDeniedError' ? 403 : 500;
        res.status(code).json(new RestResult("error","failed to delete credential",null,err.toString()))
    })
};

const testDb = function(req,res){
    Credential.findById(req.params.id)
    .then((cred)=>{
        var db_type = cred[0].db_type
        if(db_type=='mysql'){
          return mysql.query(cred[0].name,'select 1')
        }else if(db_type=='mssql'){
          return mssql.query(cred[0].name,'select 1')
        }else if(db_type=='postgres'){
          return postgres.query(cred[0].name,'select 1')
        }else if(db_type=='oracle'){
          return oracle.query(cred[0].name,'select 1')          
        }else if(db_type=='mongodb'){
          return mongodb.query(cred[0].name,'admin~system.version~{}')
        }else{
          throw new Error("Database type not set")
        }
    })
    .then(()=>{ res.json(new RestResult("success","Database connection ok",null,""))})
    .catch((err)=>{
      if(err.message?.includes("not set")){
        res.status(400).json(new RestResult("error","Database type not set",null,""))
      }else{
        res.status(502).json(new RestResult("error","Database connection failed",null,err.toString()))
      }
    })

}

export default {
  find,
  create,
  findById,
  update,
  "delete": deleteCredential,
  testDb
}