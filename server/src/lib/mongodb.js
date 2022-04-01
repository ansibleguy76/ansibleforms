//- MYSQL Module
const logger = require('./logger');
const Client = require('mongodb').MongoClient;
const Credential = require('../models/credential.model')

Mongo = {}

Mongo.query=async function(connection_name,query,callback){
  // does the pool exist already, if not let's add it
  // logger.info("["+connection_name+"] running query : " + query)
  var config=undefined
  var queryarr = query.split("~")
  if(queryarr.length!=3){
    logger.error("["+connection_name+"] query must contain 3 parts separated with '~'. " + query)
    callback(null,null)
    return;
  }
  try{
    var queryprep = JSON.parse(queryarr[2])
  }catch(err){
    logger.error("["+connection_name+"] query must be valid json. Use double quotes, not single quotes.  " + queryarr[2])
    callback(null,null)
    return;
  }

  try{
    config = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
    return;
  }

  var uri = `mongodb://${encodeURI(config.user)}:${encodeURI(config.password)}@${config.host}:${config.port}`
  // logger.debug("["+connection_name+"] uri : " + uri)
  try{
    Client.connect(uri,function(err,db){
      if(err){
        logger.debug("["+connection_name+"] Connection error : " + err)
        callback(null,null)
      }else{
        var dbo=db.db(queryarr[0])

        dbo.collection(queryarr[1]).find(queryprep).toArray(function(err,result){
          // logger.debug("["+connection_name+"] query result : " + JSON.stringify(result))
          callback(null,result)
          db.close()
        })
      }
    })
  }catch(err){
    logger.error("["+connection_name+"] " + err)
    callback(null,null)
  }

};
module.exports = Mongo
