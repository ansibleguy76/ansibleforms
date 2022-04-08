//- MYSQL Module
const logger = require('./logger');
const Client = require('mongodb').MongoClient;
const Credential = require('../models/credential.model')

Mongo = {}

Mongo.query=async function(connection_name,query){
  // does the pool exist already, if not let's add it
  // logger.info("["+connection_name+"] running query : " + query)
  var config=undefined
  var queryarr = query.split("~")
  if(queryarr.length!=3){
    return Promise.reject("["+connection_name+"] query must contain 3 parts separated with '~'. " + query)
  }
  try{
    var queryprep = JSON.parse(queryarr[2])
  }catch(err){
    return Promise.reject("["+connection_name+"] query must be valid json. Use double quotes, not single quotes.  " + queryarr[2])
  }

  Credential.findByName(connection_name)
  .then((config)=>{
    Client.connect(uri,function(err,db){
      if(err){
        throw ("["+connection_name+"] Connection error : " + err)
      }else{
        var dbo=db.db(queryarr[0])
        dbo.collection(queryarr[1]).find(queryprep).toArray(function(err,result){
          db.close()
          if(err){
            throw `[${connection_name}] query error ${err.toString()}`
          }
          return result
        })
      }
    })
  })

  var uri = `mongodb://${encodeURI(config.user)}:${encodeURI(config.password)}@${config.host}:${config.port}`
  // logger.debug("["+connection_name+"] uri : " + uri)
  try{

  }catch(err){
    logger.error("["+connection_name+"] " + err)
    callback(null,null)
  }

};
module.exports = Mongo
