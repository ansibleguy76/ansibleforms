'use strict';
const Credential = require('../models/credential.model');
var RestResult = require('../models/restResult.model');
const mysql=require("../lib/mysql")
const postgres=require("../lib/postgres")
const mssql=require("../lib/mssql")

exports.find = function(req, res) {
  if(req.query.name){
    Credential.findByName2(req.query.name)
    .then((credential)=>{res.json(new RestResult("success","credentials found",credential,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find credentials",null,err.toString()))})
  }else{
    Credential.findAll()
    .then((credentials)=>{res.json(new RestResult("success","credentials found",credentials,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find credentials",null,err.toString()))})
  }
};
exports.create = function(req, res) {
    const new_credential = new Credential(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.create(new_credential)
        .then((credential)=>{ res.json(new RestResult("success","credential added",credential,"")) })
        .catch((err)=>{ res.json(new RestResult("error","failed to create credential",null,err.toString())) })
    }
};
exports.findById = function(req, res) {
    Credential.findById(req.params.id)
    .then((credential)=>{
      if(credential.length>0){
        res.json(new RestResult("success","found credential",credential[0],""));
      }else{
        res.json(new RestResult("error","failed to find credential",null,err.toString()))
      }
    })
    .catch((err)=>{ res.json(new RestResult("error","failed to find credential",null,err.toString())) })
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Credential.update(new Credential(req.body),req.params.id)
        .then((credential)=>{res.json(new RestResult("success","credential updated",null,""))})
        .catch((err)=>{ res.json(new RestResult("error","failed to update credential",null,err.toString())) })
    }
};
exports.delete = function(req, res) {
    Credential.delete(req.params.id)
    .then(()=>{res.json(new RestResult("success","credential deleted",null,""))})
    .catch((err)=>{ res.json(new RestResult("error","failed to delete credential",null,err.toString())) })
};
exports.testDb = function(req,res){
    Credential.findById(req.params.id)
    .then((cred)=>{
        var db_type = cred[0].db_type
        if(db_type=='mysql'){
          return mysql.query(cred[0].name,'select 1')
        }else if(db_type=='mssql'){
          return mssql.query(cred[0].name,'select 1')
        }else if(db_type=='postgres'){
          return postgres.query(cred[0].name,'select 1')
        }else if(db_type=='mongodb'){
          throw new Error("Mongodb test is not implemented")
        }else{
          throw new Error("Database type not set")
        }
    })
    .then(()=>{ res.json(new RestResult("success","Database connection ok",null,""))})
    .catch((err)=>{
      if(err.message.includes("not set")){
        res.json(new RestResult("error","Database type not set",null,""))
      }else{
        res.json(new RestResult("error","Database connection failed",null,err.toString()))
      }
    })

}
